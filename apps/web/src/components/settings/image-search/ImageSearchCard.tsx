import { useEffect, useState } from "react";
import { IMAGE_SEARCH_ENGINE_NAMES, type ImageSearchSettings } from "@stash/shared";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#components/ui/card";
import { Field, FieldDescription, FieldLabel } from "#components/ui/field";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "#components/ui/select";
import { Switch } from "#components/ui/switch";
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { FieldSkeleton } from "#components/settings/skeletons";
import { ImageSearchEnginesField } from "#components/settings/image-search/ImageSearchEnginesField";
import { useImageSearchSettings } from "#hooks/useImageSearch";
import { toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

/** Reverse image search: which engines, in what order, and what the button does. */
export function ImageSearchCard() {
  const { settings, save } = useImageSearchSettings();
  const [draft, setDraft] = useState<ImageSearchSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (settings && !draft) setDraft(settings);
  }, [settings, draft]);

  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(settings);
  const set = (patch: Partial<ImageSearchSettings>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  async function submit() {
    if (!draft) return;
    setSaving(true);
    try {
      setDraft(await save(draft));
      toastSuccess(m.image_search_saved(), { id: "image-search-settings" });
    } catch (err) {
      toastError(m.save_failed(), err, { id: "image-search-settings" });
    } finally {
      setSaving(false);
    }
  }

  const quickItems: Record<string, string> = {
    menu: m.image_search_quick_menu(),
    ...Object.fromEntries(draft?.engines.map((e) => [e, IMAGE_SEARCH_ENGINE_NAMES[e]]) ?? []),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.image_search_title()}</CardTitle>
        <CardDescription>{m.image_search_description()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!draft ? (
          <>
            <FieldSkeleton />
            <FieldSkeleton />
          </>
        ) : (
          <div className="animate-fade-in space-y-4">
            <Field>
              <FieldLabel>{m.image_search_engines()}</FieldLabel>
              <ImageSearchEnginesField
                value={draft.engines}
                onChange={(engines) =>
                  set({ engines, quickAction: draft.quickAction !== "menu" && !engines.includes(draft.quickAction) ? "menu" : draft.quickAction })
                }
              />
              <FieldDescription>{m.image_search_engines_hint()}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>{m.image_search_quick()}</FieldLabel>
              <Select value={draft.quickAction} items={quickItems} onValueChange={(v) => v && set({ quickAction: v as ImageSearchSettings["quickAction"] })}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {Object.entries(quickItems).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <FieldDescription>{m.image_search_quick_hint()}</FieldDescription>
            </Field>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                {m.image_search_all_option()}
                <span className="block text-muted-foreground text-xs">{m.image_search_all_hint()}</span>
              </span>
              <Switch checked={draft.searchAll} onCheckedChange={(searchAll) => set({ searchAll })} />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                {m.image_search_on_tiles()}
                <span className="block text-muted-foreground text-xs">{m.image_search_on_tiles_hint()}</span>
              </span>
              <Switch checked={draft.onTiles} onCheckedChange={(onTiles) => set({ onTiles })} />
            </label>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button disabled={!dirty || saving} onClick={submit}>
          {saving && <Spinner />}
          {m.common_save()}
        </Button>
      </CardFooter>
    </Card>
  );
}
