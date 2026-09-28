import { useId, useState } from "react";
import { createCallable } from "react-call";
import type { Message } from "@stash/shared";
import { Dialog, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "#components/ui/dialog";
import { Field, FieldLabel } from "#components/ui/field";
import { useQuery } from "@tanstack/react-query";
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { TagsField } from "#components/TagsField";
import { SuggestField } from "#components/SuggestField";
import { tagsQuery } from "#lib/queries";
import { useEntered } from "#hooks/useEntered";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

interface Props {
  message: Message;
  /** Categories to suggest (the configured list plus those in use). */
  categories: string[];
  onSave: (labels: { category: string; tags: string[] }) => Promise<unknown>;
}

/** Set a message's category and tags by hand. */
export const EditLabelsDialog = createCallable<Props, boolean>(({ message, categories, onSave, call }) => {
  const id = useId();
  const entered = useEntered();
  const [category, setCategory] = useState(message.category);
  const [tags, setTags] = useState(message.tags);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { data: tagsInUse } = useQuery(tagsQuery);

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await onSave({ category, tags });
      call.end(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && !saving && call.end(false)}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{m.labels_title()}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <Field>
            <FieldLabel htmlFor={`${id}-category`}>{m.labels_category()}</FieldLabel>
            <SuggestField
              id={`${id}-category`}
              value={category} onChange={setCategory}
              suggestions={categories}
              emptyLabel={m.labels_category_new()}
            />
          </Field>
          <Field>
            <FieldLabel>{m.labels_tags()}</FieldLabel>
            <TagsField tags={tags} onChange={setTags} suggestions={(tagsInUse ?? []).map((t) => t.tag)} />
          </Field>
        </DialogPanel>
        <DialogFooter className="sm:items-center">
          {error && <p className="col-span-full me-auto text-destructive text-sm">{error}</p>}
          <Button variant="outline" disabled={saving} onClick={() => call.end(false)}>
            {m.common_cancel()}
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Spinner />}
            {m.common_save()}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}, 200);
