import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Progress } from "#components/ui/progress";
import { Spinner } from "#components/ui/spinner";
import type { ExportState } from "#hooks/useExport";
import { formatBytes } from "#lib/format";
import { m } from "#lib/i18n";

/** Where a running (or finished) export is: files, bytes, volume, and what failed. */
export function ExportProgress({ state }: { state: ExportState }) {
  const pct = state.phase === "done" ? 100 : state.totalBytes ? Math.min(100, (state.bytes / state.totalBytes) * 100) : 0;
  // `files` only counts files that made it into the archive.
  const packed = state.files;

  return (
    <div className="space-y-3">
      {state.phase === "listing" && (
        <p className="flex items-center gap-2 text-sm">
          <Spinner className="size-4" />
          {m.export_listing({ count: state.listed })}
        </p>
      )}
      {state.phase !== "listing" && (
        <>
          <Progress value={pct} />
          <div className="flex flex-wrap justify-between gap-x-4 text-muted-foreground text-xs tabular-nums">
            <span>
              {m.export_progress_files({ done: Math.min(state.files, state.totalFiles), total: state.totalFiles })} ·{" "}
              {formatBytes(state.bytes)} / {formatBytes(state.totalBytes)}
            </span>
            {state.volumes > 1 && <span>{m.export_progress_volume({ volume: state.volume, volumes: state.volumes })}</span>}
          </div>
          {state.phase === "packing" && state.current && (
            <p className="truncate font-mono text-muted-foreground text-xs">{state.current}</p>
          )}
        </>
      )}

      {state.phase === "done" && (
        <p className="flex items-center gap-2 text-sm text-success-foreground">
          <CircleCheckIcon className="size-4" />
          {state.streamed ? m.export_done_saved({ count: packed }) : m.export_done_downloaded({ count: packed, volumes: state.volumes })}
        </p>
      )}
      {state.phase === "cancelled" && <p className="text-muted-foreground text-sm">{m.export_cancelled()}</p>}
      {state.phase === "error" && (
        <p className="flex items-center gap-2 text-destructive-foreground text-sm">
          <CircleAlertIcon className="size-4 shrink-0" />
          {m.export_failed({ error: state.error ?? "" })}
        </p>
      )}

      {state.unsaved.length > 0 && state.phase !== "listing" && (
        <p className="text-muted-foreground text-xs">{m.export_unsaved_note({ count: state.unsaved.length })}</p>
      )}
      {state.failures.length > 0 && (
        <div className="space-y-1 rounded-lg bg-destructive/8 px-3 py-2">
          <p className="text-destructive-foreground text-xs">{m.export_failures({ count: state.failures.length })}</p>
          <ul className="max-h-28 space-y-0.5 overflow-auto font-mono text-xs">
            {state.failures.map((f) => (
              <li key={f.file.attachment.id} className="truncate">
                {f.file.path} — {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
