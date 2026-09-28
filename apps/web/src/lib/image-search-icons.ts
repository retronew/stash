import type { ImageSearchEngine } from "@stash/shared";

/** Each engine's favicon, bundled in public/engines/ (no request to the engine until you search). */
export function engineIconUrl(engine: ImageSearchEngine): string {
  return `/engines/${engine}.${engine === "iqdb" ? "jpg" : "png"}`;
}
