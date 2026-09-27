import { createCallable } from "react-call";
import { useEntered } from "#hooks/useEntered";
import { DownloadIcon } from "lucide-react";
import { attachmentUrl, type Attachment } from "@stash/shared";
import { Dialog, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "#components/ui/dialog";
import { Button } from "#components/ui/button";
import { formatBytes } from "#lib/format";
import { m } from "#lib/i18n";

interface Props {
  attachment: Attachment;
}

/** Full-size view of a stored image, video or audio file, with a download button. */
export const MediaViewer = createCallable<Props, void>(({ attachment: a, call }) => {
  const entered = useEntered();
  const src = attachmentUrl(a.id);

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && call.end()}>
      <DialogPopup className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate text-base">{a.filename || m.attachment_untitled()}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70svh] justify-center overflow-auto px-6">
          {a.kind === "image" && <img src={src} alt={a.filename} className="max-h-[70svh] w-auto object-contain" />}
          {a.kind === "video" && <video src={src} controls className="max-h-[70svh] w-full" />}
          {a.kind === "audio" && <audio src={src} controls className="w-full" />}
        </div>
        <DialogFooter className="sm:items-center">
          <span className="me-auto text-muted-foreground text-sm">
            {formatBytes(a.storedSize ?? 0)}
            {a.width && a.height ? ` · ${a.width}×${a.height}` : ""}
          </span>
          <Button variant="outline" render={<a href={attachmentUrl(a.id, true)} />}>
            <DownloadIcon />
            {m.attachment_download()}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}, 200);
