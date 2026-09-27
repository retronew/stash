import { useEffect, useId, useState } from "react";
import type { AnalysisSettings } from "@stash/shared";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#components/ui/card";
import { Field, FieldDescription, FieldLabel } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { Switch } from "#components/ui/switch";
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { TagsField } from "#components/TagsField";
import { FieldSkeleton } from "#components/settings/skeletons";
import { useAnalysis } from "#hooks/useAnalysis";
import { toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

/** What AI analysis does: automatic or not, the daily cap, the categories to choose from. */
export function AnalysisSettingsCard() {
  const id = useId();
  const { settings, save } = useAnalysis();
  const [draft, setDraft] = useState<AnalysisSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (settings && !draft) setDraft(settings);
  }, [settings, draft]);

  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(settings);
  const set = (patch: Partial<AnalysisSettings>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  async function submit() {
    if (!draft) return;
    setSaving(true);
    try {
      setDraft(await save(draft));
      toastSuccess(m.analysis_settings_saved(), { id: "analysis-settings" });
    } catch (err) {
      toastError(m.save_failed(), err, { id: "analysis-settings" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.analysis_title()}</CardTitle>
        <CardDescription>{m.analysis_description()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!draft ? (
          <>
            <FieldSkeleton />
            <FieldSkeleton />
          </>
        ) : (
          <div className="animate-fade-in space-y-4">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                {m.analysis_auto()}
                <span className="block text-muted-foreground text-xs">{m.analysis_auto_hint()}</span>
              </span>
              <Switch checked={draft.auto} onCheckedChange={(auto) => set({ auto })} />
            </label>
            <Field>
              <FieldLabel htmlFor={`${id}-limit`}>{m.analysis_daily_limit()}</FieldLabel>
              <Input
                id={`${id}-limit`}
                type="number"
                min={0}
                className="w-32"
                value={String(draft.dailyLimit)}
                onChange={(e) => set({ dailyLimit: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              />
              <FieldDescription>{m.analysis_daily_limit_hint()}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-images`}>{m.analysis_max_images()}</FieldLabel>
              <Input
                id={`${id}-images`}
                type="number"
                min={0}
                max={10}
                className="w-32"
                value={String(draft.maxImages)}
                onChange={(e) => set({ maxImages: Math.min(10, Math.max(0, Math.floor(Number(e.target.value) || 0))) })}
              />
              <FieldDescription>{m.analysis_max_images_hint()}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>{m.analysis_categories()}</FieldLabel>
              <TagsField tags={draft.categories} onChange={(categories) => set({ categories })} suggestions={[]} />
              <FieldDescription>{m.analysis_categories_hint()}</FieldDescription>
            </Field>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={submit} disabled={!dirty || saving}>
          {saving && <Spinner />}
          {m.common_save()}
        </Button>
      </CardFooter>
    </Card>
  );
}
