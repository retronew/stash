// Reverse image search (after dessant/search-by-image): each engine takes a
// public image URL. Stash hands it a short-lived signed link to the file.
// Engines that only take an upload there (Baidu, Pinterest, stock sites…)
// need a browser extension and aren't offered.

export const IMAGE_SEARCH_ENGINES = [
  "google",
  "bing",
  "yandex",
  "tineye",
  "sogou",
  "lenso",
  "saucenao",
  "iqdb",
  "ascii2d",
  "tracemoe",
] as const;
export type ImageSearchEngine = (typeof IMAGE_SEARCH_ENGINES)[number];

export function isImageSearchEngine(value: unknown): value is ImageSearchEngine {
  return IMAGE_SEARCH_ENGINES.includes(value as ImageSearchEngine);
}

/** Display names (brand names, not translated). */
export const IMAGE_SEARCH_ENGINE_NAMES: Record<ImageSearchEngine, string> = {
  google: "Google Lens",
  bing: "Bing",
  yandex: "Yandex",
  tineye: "TinEye",
  sogou: "Sogou",
  lenso: "Lenso.ai",
  saucenao: "SauceNAO",
  iqdb: "IQDB",
  ascii2d: "ascii2d",
  tracemoe: "trace.moe",
};

const TEMPLATES: Record<ImageSearchEngine, (u: string) => string> = {
  google: (u) => `https://lens.google.com/uploadbyurl?url=${u}`,
  bing: (u) => `https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIVSP&sbisrc=UrlPaste&q=imgurl:${u}`,
  yandex: (u) => `https://yandex.com/images/search?rpt=imageview&url=${u}`,
  tineye: (u) => `https://tineye.com/search?url=${u}`,
  sogou: (u) => `https://pic.sogou.com/ris?query=${u}&flag=1&drag=0`,
  lenso: (u) => `https://lenso.ai/en/search-by-url?url=${u}`,
  saucenao: (u) => `https://saucenao.com/search.php?url=${u}`,
  iqdb: (u) => `https://iqdb.org/?url=${u}`,
  ascii2d: (u) => `https://ascii2d.net/search/url/${u}`,
  tracemoe: (u) => `https://trace.moe/?url=${u}`,
};

/** The engine's results page for the image at `imageUrl`. */
export function imageSearchUrl(engine: ImageSearchEngine, imageUrl: string): string {
  return TEMPLATES[engine](encodeURIComponent(imageUrl));
}

export interface ImageSearchSettings {
  /** Engines shown in the menu, in this order. */
  engines: ImageSearchEngine[];
  /** What the search button does: search with one engine, or open the menu. */
  quickAction: ImageSearchEngine | "menu";
  /** Add "All engines" to the menu (opens a tab per engine). */
  searchAll: boolean;
  /** Show the search button on image tiles in the list, not only in the viewer. */
  onTiles: boolean;
}

export function defaultImageSearchSettings(): ImageSearchSettings {
  return { engines: ["google", "bing", "yandex", "tineye", "saucenao"], quickAction: "menu", searchAll: true, onTiles: true };
}

/** Coerces stored or submitted JSON into valid settings. */
export function normalizeImageSearchSettings(value: unknown): ImageSearchSettings {
  const d = defaultImageSearchSettings();
  if (!value || typeof value !== "object") return d;
  const v = value as Record<string, unknown>;
  const engines = Array.isArray(v.engines) ? [...new Set(v.engines.filter(isImageSearchEngine))] : d.engines;
  const quickAction =
    v.quickAction === "menu" || (isImageSearchEngine(v.quickAction) && engines.includes(v.quickAction)) ? v.quickAction : "menu";
  return {
    engines,
    quickAction,
    searchAll: typeof v.searchAll === "boolean" ? v.searchAll : d.searchAll,
    onTiles: typeof v.onTiles === "boolean" ? v.onTiles : d.onTiles,
  };
}
