import { FileIcon, FilmIcon, ImageIcon, MusicIcon } from "lucide-react";
import { attachmentUrl, type Attachment } from "@stash/shared";
import { cn } from "#lib/utils";

const KIND_ICON = { image: ImageIcon, video: FilmIcon, audio: MusicIcon, file: FileIcon };

/** A stored image's thumbnail, or the kind's icon. Size it with className (default size-10). */
export function TaskThumb({ attachment: a, className }: { attachment: Attachment; className?: string }) {
  const Icon = KIND_ICON[a.kind];
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40", className)}>
      {a.status === "stored" && a.kind === "image" ? (
        <img src={attachmentUrl(a.id)} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <Icon className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}
