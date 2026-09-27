import { AlertTriangleIcon, DownloadIcon, FileIcon, FilmIcon, ImageIcon, MusicIcon, RotateCwIcon } from "lucide-react";
import { attachmentUrl, thumbnailUrl, type Attachment } from "@stash/shared";
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "#components/ui/tooltip";
import { formatBytes } from "#lib/format";
import { m } from "#lib/i18n";
import { cn } from "#lib/utils";

interface Props {
  attachment: Attachment;
  onOpen: (attachment: Attachment) => void;
  onRetry: (id: number) => void;
}

const KIND_ICON = { image: ImageIcon, video: FilmIcon, audio: MusicIcon, file: FileIcon };

const tileClass = "relative flex aspect-square w-full overflow-hidden rounded-lg border bg-muted/40";

/** One attachment in a message: the image, a file card, or its download state. */
export function AttachmentTile({ attachment: a, onOpen, onRetry }: Props) {
  if (a.status === "stored" && a.kind === "image") {
    return (
      <button type="button" className={cn(tileClass, "cursor-zoom-in")} onClick={() => onOpen(a)}>
        <img
          src={thumbnailUrl(a.id)}
          alt={a.filename}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-200 hover:scale-[1.03]"
        />
      </button>
    );
  }

  if (a.status === "stored") {
    const Icon = KIND_ICON[a.kind];
    const openable = a.kind === "video" || a.kind === "audio";
    return (
      <div className={cn(tileClass, "flex-col items-center justify-center gap-2 p-3 text-center")}>
        <Icon className="size-6 text-muted-foreground" />
        <span className="line-clamp-2 break-all text-xs">{a.filename || m.attachment_untitled()}</span>
        <span className="text-muted-foreground text-xs">{formatBytes(a.storedSize ?? 0)}</span>
        <div className="flex gap-1">
          {openable && (
            <Button size="xs" variant="outline" onClick={() => onOpen(a)}>
              {m.attachment_play()}
            </Button>
          )}
          <Button size="icon-xs" variant="ghost" aria-label={m.attachment_download()} render={<a href={attachmentUrl(a.id, true)} />}>
            <DownloadIcon />
          </Button>
        </div>
      </div>
    );
  }

  if (a.status === "failed") {
    return (
      <div className={cn(tileClass, "flex-col items-center justify-center gap-2 p-3 text-center")}>
        <AlertTriangleIcon className="size-5 text-destructive-foreground" />
        <Tooltip>
          <TooltipTrigger render={<span tabIndex={0} className="line-clamp-2 text-xs" />}>
            {m.attachment_failed()}
          </TooltipTrigger>
          <TooltipPopup className="max-w-72 break-words">{a.lastError}</TooltipPopup>
        </Tooltip>
        <Button size="xs" variant="outline" onClick={() => onRetry(a.id)}>
          <RotateCwIcon />
          {m.action_retry()}
        </Button>
      </div>
    );
  }

  // pending / downloading
  return (
    <div className={cn(tileClass, "flex-col items-center justify-center gap-2 p-3 text-center text-muted-foreground")}>
      <Spinner className="size-4" />
      <span className="text-xs">
        {a.status === "downloading" ? m.attachment_downloading() : m.attachment_queued()}
      </span>
      {a.size ? <span className="text-xs">{formatBytes(a.size)}</span> : null}
      {a.attempts > 0 && a.lastError && (
        <span className="text-xs">{m.attachment_attempt({ count: a.attempts })}</span>
      )}
    </div>
  );
}
