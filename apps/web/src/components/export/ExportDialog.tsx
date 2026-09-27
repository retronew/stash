import { useState } from "react";
import { createCallable } from "react-call";
import { DownloadIcon, RotateCwIcon } from "lucide-react";
import { Dialog, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogDescription } from "#components/ui/dialog";
import { Button } from "#components/ui/button";
import { ExportForm } from "#components/export/ExportForm";
import { ExportProgress } from "#components/export/ExportProgress";
import { useEntered } from "#hooks/useEntered";
import { useAccounts } from "#hooks/useAccounts";
import { useExport } from "#hooks/useExport";
import { accountLabel } from "#lib/labels";
import { canStreamToDisk } from "#lib/save-file";
import type { ExportOptions } from "#lib/export-plan";
import { m } from "#lib/i18n";

export const DEFAULT_EXPORT: ExportOptions = {
  platforms: [],
  accounts: [],
  chatTypes: [],
  chatIds: [],
  from: "",
  to: "",
  kinds: ["image", "video", "audio", "file"],
  layout: "bot",
  includeMessages: true,
};

interface Props {
  /** Pre-filled from the page's filters. */
  initial?: Partial<ExportOptions>;
}

/** Choose what to export, then watch it download; the ZIP is built in the browser. */
export const ExportDialog = createCallable<Props, void>(({ initial, call }) => {
  const entered = useEntered();
  const [options, setOptions] = useState<ExportOptions>({ ...DEFAULT_EXPORT, ...initial });
  const { accounts } = useAccounts();
  const byId = new Map((accounts ?? []).map((a) => [a.id, a]));
  const botName = (id: string) => {
    const a = byId.get(id);
    return a ? accountLabel(a) : id.slice(0, 8);
  };
  const exporter = useExport(botName);
  const running = exporter.state?.phase === "listing" || exporter.state?.phase === "packing";

  function close() {
    if (running) exporter.cancel();
    call.end();
  }

  function retryFailed() {
    const failed = exporter.state?.failures ?? [];
    exporter.start(options, { files: failed.map((f) => f.file), messages: [] });
  }

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && close()}>
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{m.export_title()}</DialogTitle>
          <DialogDescription>{canStreamToDisk() ? m.export_mode_stream() : m.export_mode_volumes()}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {exporter.state ? (
            <ExportProgress state={exporter.state} />
          ) : (
            <ExportForm value={options} onChange={(patch) => setOptions((o) => ({ ...o, ...patch }))} accounts={accounts ?? []} />
          )}
        </DialogPanel>
        <DialogFooter>
          {!exporter.state && (
            <>
              <Button variant="outline" onClick={close}>
                {m.common_cancel()}
              </Button>
              <Button disabled={options.kinds.length === 0 && !options.includeMessages} onClick={() => exporter.start(options)}>
                <DownloadIcon />
                {m.export_start()}
              </Button>
            </>
          )}
          {running && (
            <Button variant="outline" onClick={exporter.cancel}>
              {m.export_stop()}
            </Button>
          )}
          {exporter.state && !running && (
            <>
              {exporter.state.phase === "done" && exporter.state.failures.length > 0 && (
                <Button variant="outline" onClick={retryFailed}>
                  <RotateCwIcon />
                  {m.export_retry_failed({ count: exporter.state.failures.length })}
                </Button>
              )}
              {exporter.state.phase !== "done" && (
                <Button variant="outline" onClick={exporter.reset}>
                  {m.export_back()}
                </Button>
              )}
              <Button onClick={close}>{m.action_close()}</Button>
            </>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}, 200);
