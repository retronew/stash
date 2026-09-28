import type { ImageSearchEngine } from "@stash/shared";
import { engineIconUrl } from "#lib/image-search-icons";
import { cn } from "#lib/utils";

/** An image search engine's favicon, decorative (the engine's name is shown beside it). */
export function EngineIcon({ engine, className }: { engine: ImageSearchEngine; className?: string }) {
  return <img src={engineIconUrl(engine)} alt="" aria-hidden className={cn("size-4 shrink-0 rounded-sm object-contain", className)} />;
}
