import { useId, useState } from "react";
import { createCallable } from "react-call";
import { useEntered } from "#hooks/useEntered";
import { RefreshCwIcon } from "lucide-react";
import type { Account, Platform } from "@stash/shared";
import { Dialog, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "#components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { Button } from "#components/ui/button";
import { Switch } from "#components/ui/switch";
import { Spinner } from "#components/ui/spinner";
import { webhookUrl, type AccountPayload } from "#hooks/useAccounts";
import { platformInfo } from "#lib/platforms";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

interface Props {
  /** null: adding a new account. */
  account: Account | null;
  /** The new account's platform (ignored when editing). */
  platform: Platform;
  origin: string;
  /** Resolves when saved; a thrown error is shown and the dialog stays open. */
  onSubmit: (payload: AccountPayload) => Promise<unknown>;
}

const randomKey = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);
const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** Add or edit a bot: its name, the platform's two credentials and the webhook path. */
export const AccountFormDialog = createCallable<Props, boolean>(({ account, platform: newPlatform, origin, onSubmit, call }) => {
  const platform = platformInfo(account?.platform ?? newPlatform);
  const id = useId();
  const entered = useEntered();
  const [form, setForm] = useState<AccountPayload>({
    name: account?.name ?? "",
    appId: account?.appId ?? "",
    appSecret: "",
    webhookKey: account?.webhookKey ?? randomKey(),
    enabled: account?.enabled ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<AccountPayload>) => setForm((f) => ({ ...f, ...patch }));

  const keyValid = KEY_RE.test(form.webhookKey);
  const canSave = !!form.appId.trim() && (!!account || !!form.appSecret.trim()) && keyValid && !saving;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit(form);
      call.end(true);
    } catch (err) {
      const message = errorMessage(err);
      setError(message === "webhook_key_taken" ? m.account_key_taken() : message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && !saving && call.end(false)}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{(account ? m.account_edit_title : m.account_add_title)({ platform: platform.label() })}</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <form
            id={`${id}-form`}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>{m.account_name()}</FieldLabel>
              <Input
                id={`${id}-name`}
                value={form.name}
                placeholder={m.account_name_placeholder()}
                onChange={(e) => set({ name: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-app-id`}>{platform.credentials.id()}</FieldLabel>
              <Input id={`${id}-app-id`} value={form.appId} autoComplete="off" onChange={(e) => set({ appId: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-secret`}>{platform.credentials.secret()}</FieldLabel>
              <Input
                id={`${id}-secret`}
                type="password"
                autoComplete="new-password"
                value={form.appSecret}
                placeholder={account?.appSecretMasked ? m.account_secret_keep({ masked: account.appSecretMasked }) : ""}
                onChange={(e) => set({ appSecret: e.target.value })}
              />
              <FieldDescription>{m.account_secret_hint()}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-key`}>{m.account_webhook_path()}</FieldLabel>
              <div className="flex w-full gap-2">
                <Input
                  id={`${id}-key`}
                  value={form.webhookKey}
                  aria-invalid={!keyValid || undefined}
                  onChange={(e) => set({ webhookKey: e.target.value.trim() })}
                />
                <Button type="button" variant="outline" size="icon" aria-label={m.account_webhook_regenerate()} onClick={() => set({ webhookKey: randomKey() })}>
                  <RefreshCwIcon />
                </Button>
              </div>
              <FieldDescription className="break-all">
                {webhookUrl(origin, { platform: platform.id, webhookKey: form.webhookKey || "…" })}
              </FieldDescription>
              {!keyValid && <p className="text-destructive text-xs">{m.account_webhook_invalid()}</p>}
            </Field>
            <label className="flex items-center justify-between gap-4 text-sm">
              {m.account_enabled()}
              <Switch checked={form.enabled} onCheckedChange={(enabled) => set({ enabled })} />
            </label>
          </form>
        </DialogPanel>
        <DialogFooter className="sm:items-center">
          {error && <p className="col-span-full me-auto text-destructive text-sm">{error}</p>}
          <Button variant="outline" disabled={saving} onClick={() => call.end(false)}>
            {m.common_cancel()}
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={!canSave}>
            {saving && <Spinner />}
            {m.common_save()}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}, 200);
