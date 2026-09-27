import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon, Trash2Icon } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { CopyButton } from "#components/CopyButton";
import { Confirm } from "#components/Confirm";
import { TextSkeleton } from "#components/settings/skeletons";
import { api, toastError, toastSuccess } from "#lib/api";
import { apiTokenQuery } from "#lib/queries";
import { m } from "#lib/i18n";

/** A bearer token for scripts (e.g. backing up files); shown once, masked afterwards. */
export function ApiTokenCard() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(apiTokenQuery);
  const masked = data?.masked ?? null;
  const [newToken, setNewToken] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: apiTokenQuery.queryKey });

  async function reset() {
    if (masked) {
      const ok = await Confirm.call({
        title: m.token_reset_title(),
        message: m.token_reset_message(),
        confirmLabel: m.token_reset(),
        danger: true,
      });
      if (!ok) return;
    }
    try {
      const { token } = await api<{ token: string }>("/api/settings/api-token/reset", { method: "POST" });
      setNewToken(token);
      toastSuccess(m.token_generated(), { description: m.token_copy_now(), id: "api-token" });
      await refresh();
    } catch (err) {
      toastError(m.token_generate_failed(), err, { id: "api-token" });
    }
  }

  async function revoke() {
    const ok = await Confirm.call({
      title: m.token_revoke_title(),
      message: m.token_revoke_message(),
      confirmLabel: m.token_revoke(),
      danger: true,
    });
    if (!ok) return;
    try {
      await api("/api/settings/api-token", { method: "DELETE" });
      setNewToken("");
      toastSuccess(m.token_revoked(), { id: "api-token" });
      await refresh();
    } catch (err) {
      toastError(m.token_generate_failed(), err, { id: "api-token" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Token</CardTitle>
        <CardDescription>{m.token_description()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {newToken ? (
          <>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">{newToken}</code>
              <CopyButton text={newToken} variant="outline" size="icon-sm" aria-label={m.action_copy()} />
            </div>
            <p className="text-muted-foreground text-xs">{m.token_shown_once()}</p>
          </>
        ) : isPending ? (
          <TextSkeleton className="my-0.5 w-48" />
        ) : masked ? (
          <p className="animate-fade-in text-muted-foreground text-sm">
            {m.token_current()}
            <code className="text-foreground">{masked}</code>
          </p>
        ) : (
          <p className="animate-fade-in text-muted-foreground text-sm">{m.token_none()}</p>
        )}
        <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs">
          {`curl -H "Authorization: Bearer <token>" \\\n  ${window.location.origin}/api/messages`}
        </pre>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" onClick={reset} disabled={isPending}>
          <RefreshCwIcon />
          {masked ? m.token_reset_button() : m.token_generate_button()}
        </Button>
        {masked && (
          <Button variant="ghost" onClick={revoke} className="text-muted-foreground hover:text-destructive-foreground">
            <Trash2Icon />
            {m.token_revoke()}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
