import { useCallback, useRef, useState } from "react";
import { makeZip } from "client-zip";
import { attachmentUrl, type Message, type MessagePage } from "@stash/shared";
import { api } from "#lib/api";
import { dateRange } from "#lib/date-range";
import {
  messagesJson,
  planFiles,
  reportText,
  splitVolumes,
  zipName,
  type ExportFailure,
  type ExportFile,
  type ExportOptions,
} from "#lib/export-plan";
import { canStreamToDisk, pickZipFile, saveBlob } from "#lib/save-file";

// Runs an export in the browser: list the matching messages, fetch the
// files three at a time, and write them into a ZIP (streamed to disk, or
// in volumes of up to 500 MB where that isn't possible).

const CONCURRENCY = 3;
const ATTEMPTS = 3;
/** Files up to this are fetched completely before going into the ZIP, so a
 *  dropped connection is retried instead of corrupting the archive. */
const BUFFER_LIMIT = 24 * 1024 * 1024;
const PAGE = 100;

export type ExportPhase = "listing" | "packing" | "done" | "cancelled" | "error";

export interface ExportState {
  phase: ExportPhase;
  listed: number;
  files: number;
  totalFiles: number;
  bytes: number;
  totalBytes: number;
  current: string;
  volume: number;
  volumes: number;
  failures: ExportFailure[];
  unsaved: ExportFile[];
  streamed: boolean;
  error?: string;
}

class Cancelled extends Error {}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(new Cancelled())), { once: true });
  });

function messagesUrl(o: ExportOptions, before: number | null): string {
  const p = new URLSearchParams({ limit: String(PAGE) });
  const { since, until } = dateRange(o.from, o.to);
  if (before) p.set("before", String(before));
  if (o.platforms.length) p.set("platform", o.platforms.join(","));
  if (o.accounts.length) p.set("account", o.accounts.join(","));
  if (o.chatTypes.length) p.set("chat", o.chatTypes.join(","));
  if (o.chatIds.length) p.set("chatid", o.chatIds.join(","));
  if (since) p.set("since", String(since));
  if (until) p.set("until", String(until));
  // Without messages.json only messages with files matter.
  if (!o.includeMessages) p.set("media", "1");
  return `/api/messages?${p}`;
}

type Fetched = { ok: true; file: ExportFile; input: Uint8Array | ReadableStream<Uint8Array> } | { ok: false; file: ExportFile; error: string };

export function useExport(botName: (accountId: string) => string) {
  const [state, setState] = useState<ExportState | null>(null);
  const abort = useRef<AbortController | null>(null);
  const progress = useRef({ files: 0, bytes: 0, current: "" });

  const cancel = useCallback(() => abort.current?.abort(), []);

  /** Runs an export. `only` re-exports just these files (e.g. the ones that failed). */
  const start = useCallback(
    async (options: ExportOptions, only?: { files: ExportFile[]; messages: Message[] }) => {
      const controller = new AbortController();
      abort.current = controller;
      const { signal } = controller;
      const streamed = canStreamToDisk();
      const suffix = only ? "-retry" : "";

      // The file picker needs the click's user activation: ask before anything else.
      let writable: WritableStream<Uint8Array> | null = null;
      if (streamed) {
        writable = await pickZipFile(zipName(options.platforms, 1, 1).replace(/\.zip$/, `${suffix}.zip`));
        if (!writable) return;
      }

      progress.current = { files: 0, bytes: 0, current: "" };
      const failures: ExportFailure[] = [];
      setState({
        phase: "listing", listed: 0, files: 0, totalFiles: 0, bytes: 0, totalBytes: 0, current: "",
        volume: 0, volumes: 0, failures, unsaved: [], streamed,
      });
      // Progress is kept in a ref and copied into state a few times a second.
      const tick = setInterval(() => setState((s) => s && { ...s, ...progress.current, failures: [...failures] }), 250);

      try {
        // 1. Everything that matches.
        let messages: Message[] = only?.messages ?? [];
        if (!only) {
          let before: number | null = null;
          do {
            if (signal.aborted) throw new Cancelled();
            const page: MessagePage = await api<MessagePage>(messagesUrl(options, before));
            messages = messages.concat(page.messages);
            before = page.nextCursor;
            setState((s) => s && { ...s, listed: messages.length });
          } while (before);
        }
        const plan = only ? { files: only.files, unsaved: [] } : planFiles(messages, options.kinds, botName, options.layout);
        const sizeOf = (f: ExportFile) => f.attachment.storedSize ?? f.attachment.size ?? 0;
        const volumes = streamed ? [plan.files] : splitVolumes(plan.files, sizeOf);
        if (volumes.length === 0) volumes.push([]);
        setState((s) => s && {
          ...s, phase: "packing", unsaved: plan.unsaved, volumes: volumes.length,
          totalFiles: plan.files.length, totalBytes: plan.files.reduce((n, f) => n + sizeOf(f), 0),
        });

        // 2. One file, with retries. Small files are read whole; large ones stream.
        const fetchFile = async (file: ExportFile): Promise<Fetched> => {
          let error = "";
          for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
            try {
              const res = await fetch(attachmentUrl(file.attachment.id), { signal });
              if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
              if (sizeOf(file) <= BUFFER_LIMIT) {
                const data = new Uint8Array(await res.arrayBuffer());
                progress.current.bytes += data.byteLength;
                progress.current.files += 1;
                return { ok: true, file, input: data };
              }
              const counted = res.body.pipeThrough(
                new TransformStream<Uint8Array, Uint8Array>({
                  transform(chunk, ctl) {
                    progress.current.bytes += chunk.byteLength;
                    ctl.enqueue(chunk);
                  },
                  flush() {
                    progress.current.files += 1;
                  },
                }),
              );
              return { ok: true, file, input: counted };
            } catch (err) {
              if (signal.aborted) throw new Cancelled();
              error = err instanceof Error ? err.message : String(err);
              if (attempt < ATTEMPTS) await sleep(attempt * 1500, signal);
            }
          }
          return { ok: false, file, error };
        };

        // 3. Each volume's entries: files fetched a few ahead, then the extras.
        async function* entries(files: ExportFile[], first: boolean, last: boolean) {
          const queue: Promise<Fetched>[] = [];
          let next = 0;
          const fill = () => {
            while (queue.length < CONCURRENCY && next < files.length) queue.push(fetchFile(files[next++]));
          };
          fill();
          while (queue.length) {
            const r = await queue.shift()!;
            fill();
            progress.current.current = r.file.path;
            if (!r.ok) {
              failures.push({ file: r.file, error: r.error });
              continue;
            }
            yield { name: r.file.path, input: r.input, lastModified: new Date(r.file.message.sentAt) };
          }
          if (first && options.includeMessages && !only) {
            yield { name: "messages.json", input: messagesJson(messages, plan.files, botName), lastModified: new Date() };
          }
          if (last) {
            yield {
              name: "report.txt",
              input: reportText(plan.files.length - failures.length, plan.unsaved, failures),
              lastModified: new Date(),
            };
          }
        }

        for (let i = 0; i < volumes.length; i++) {
          setState((s) => s && { ...s, volume: i + 1 });
          const zip = makeZip(entries(volumes[i], i === 0, i === volumes.length - 1), { buffersAreUTF8: true });
          if (writable) {
            await zip.pipeTo(writable, { signal });
          } else {
            const blob = await new Response(zip).blob();
            if (signal.aborted) throw new Cancelled();
            saveBlob(blob, zipName(options.platforms, i + 1, volumes.length).replace(/\.zip$/, `${suffix}.zip`));
          }
        }
        setState((s) => s && { ...s, ...progress.current, phase: "done", failures: [...failures] });
      } catch (err) {
        const cancelled = signal.aborted || err instanceof Cancelled;
        await writable?.abort().catch(() => {});
        setState((s) => s && {
          ...s, ...progress.current, failures: [...failures],
          phase: cancelled ? "cancelled" : "error",
          error: cancelled ? undefined : err instanceof Error ? err.message : String(err),
        });
      } finally {
        clearInterval(tick);
        abort.current = null;
      }
    },
    [botName],
  );

  return { state, start, cancel, reset: () => setState(null) };
}
