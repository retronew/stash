import { PlusIcon } from "lucide-react";
import type { Account } from "@stash/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Confirm } from "#components/Confirm";
import { ListSkeleton } from "#components/settings/skeletons";
import { AccountRow } from "#components/settings/accounts/AccountRow";
import { AccountFormDialog } from "#components/settings/accounts/AccountFormDialog";
import { useAccounts } from "#hooks/useAccounts";
import { errorMessage, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

/** QQ bots Stash receives from, with the webhook URL to paste into the QQ console. */
export function AccountsCard() {
  const { accounts, origin, error, create, update, remove } = useAccounts();

  async function edit(account: Account | null) {
    const saved = await AccountFormDialog.call({
      account,
      origin,
      onSubmit: (payload) => (account ? update(account.id, payload) : create("qq", payload)),
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
          <AccountRow key={a.id} account={a} origin={origin} onEdit={() => edit(a)} onDelete={() => confirmRemove(a)} />
        ))}
        <Button variant="outline" onClick={() => edit(null)}>
          <PlusIcon />
          {m.account_add()}
        </Button>
        <ol className="list-decimal space-y-1 ps-5 text-muted-foreground text-xs">
          <li>{m.accounts_step_create()}</li>
          <li>{m.accounts_step_webhook()}</li>
          <li>{m.accounts_step_events()}</li>
        </ol>
      </CardContent>
      <AccountFormDialog />
    </Card>
  );
}
