import { useQuery, useQueryClient } from "@tanstack/react-query";
import { defaultImageSearchSettings, imageSearchUrl, type ImageSearchEngine, type ImageSearchSettings } from "@stash/shared";
import { api, toastError } from "#lib/api";
import { m } from "#lib/i18n";
import { imageSearchLinkQuery, imageSearchSettingsQuery } from "#lib/queries";

/** The reverse image search settings, and saving them. */
export function useImageSearchSettings() {
  const queryClient = useQueryClient();
  const query = useQuery(imageSearchSettingsQuery);

  async function save(next: ImageSearchSettings) {
    const saved = await api<ImageSearchSettings>("/api/settings/image-search", { method: "PUT", json: next });
    queryClient.setQueryData(imageSearchSettingsQuery.queryKey, saved);
    return saved;
  }

  return { settings: query.data, isError: query.isError, save };
}

/**
 * Reverse image search for one stored image. Engines fetch the image from a
 * short-lived public link; it's fetched ahead when `prefetch` is set (the
 * viewer, an open menu) so a click opens a plain link.
 */
export function useImageSearch(id: number, prefetch: boolean) {
  const queryClient = useQueryClient();
  const settings = useQuery(imageSearchSettingsQuery).data ?? defaultImageSearchSettings();
  const link = useQuery({ ...imageSearchLinkQuery(id), enabled: prefetch });

  /** Opens `engines` in new tabs. Tabs open right away (inside the click) so popup blockers allow them. */
  async function search(engines: ImageSearchEngine[]) {
    const tabs = engines.map((engine) => ({ engine, tab: window.open("about:blank", "_blank") }));
    try {
      const { url } = await queryClient.fetchQuery(imageSearchLinkQuery(id));
      for (const { engine, tab } of tabs) {
        const target = imageSearchUrl(engine, url);
        if (tab) {
          tab.opener = null;
          tab.location.href = target;
        } else window.open(target, "_blank", "noopener");
      }
    } catch (err) {
      for (const { tab } of tabs) tab?.close();
      toastError(m.image_search_failed(), err, { id: "image-search" });
    }
  }

  return { settings, search, loading: link.isFetching, error: link.error };
}
