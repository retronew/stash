import { PlusIcon } from "lucide-react";
import type { Account, Platform } from "@stash/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Confirm } from "#components/Confirm";
import { ListSkeleton } from "#components/settings/skeletons";
import { AccountRow } from "#components/settings/accounts/AccountRow";
import { AccountFormDialog } from "#components/settings/accounts/AccountFormDialog";
import { PlatformGuide } from "#components/settings/accounts/PlatformGuide";
import { useAccounts } from "#hooks/useAccounts";
import { platformList } from "#lib/platforms";
import { errorMessage, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

/** The bots Stash receives from, on every platform, with their webhook URLs. */
export function AccountsCard() {
  const { accounts, origin, error, create, update, remove, uploadAvatar, removeAvatar, verify } = useAccounts();
  const platforms = platformList();

  async function edit(account: Account | null, platform: Platform = account?.platform ?? platforms[0].id) {
    const saved = await AccountFormDialog.call({
      account,
      platform,
      origin,
      onSubmit: (payload) => (account ? update(account.id, payload) : create(platform, payload)),
      onVerify: (appId, appSecret) => verify({ platform, appId, appSecret, id: account?.id }),
    });
    if (saved) toastSuccess(m.account_saved(), { id: "account-save" });
  }

  async function confirmRemove(account: Account) {
    const ok = await Confirm.call({
      title: m.account_delete_title({ name: account.name || account.appId }),
      message: m.account_delete_message(),
      confirmLabel: m.action_delete(),
      danger: true,
    });
    if (!ok) return;
    try {
      await remove(account.id);
      toastSuccess(m.account_deleted(), { id: "account-delete" });
    } catch (err) {
      toastError(m.account_delete_failed(), err, { id: "account-delete" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.accounts_title()}</CardTitle>
        <CardDescription>{m.accounts_description()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!accounts && !error && <ListSkeleton rows={2} />}
        {error && <p className="text-destructive text-xs">{m.load_failed({ error: errorMessage(error) })}</p>}
        {accounts?.map((a) => (
          <AccountRow
            key={a.id}
            account={a}
            origin={origin}
            onEdit={() => edit(a)}
            onDelete={() => confirmRemove(a)}
            onUploadAvatar={(file) => uploadAvatar(a.id, file)}
            onRemoveAvatar={() => removeAvatar(a.id)}
            onVerify={() => verify({ platform: a.platform, appId: "", appSecret: "", id: a.id })}
          />
        ))}
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <Button key={p.id} variant="outline" onClick={() => edit(null, p.id)}>
              <PlusIcon />
              {m.account_add({ platform: p.label() })}
            </Button>
          ))}
        </div>
        {platforms.map((p) => (
          <PlatformGuide key={p.id} platform={p} />
        ))}
      </CardContent>
      <AccountFormDialog />
    </Card>
  );
}
