import { useState } from "react";
import { CircleCheckIcon, CircleXIcon, PlugZapIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";
import { cn } from "#lib/utils";

export type CredentialResult = { ok: true } | { ok: false; error: string };

interface Props {
  /** Runs the check; a thrown error is shown as a failure too. */
  onCheck: () => Promise<CredentialResult>;
  disabled?: boolean;
  className?: string;
}

const describe = (error: string) => (error === "missing_credentials" ? m.credentials_missing() : error);

/** "Test credentials" and its result, in the platform's own words when it refuses. */
export function CredentialCheck({ onCheck, disabled, className }: Props) {
  const [state, setState] = useState<{ status: "idle" | "checking" } | { status: "done"; result: CredentialResult; at: number }>({
    status: "idle",
  });

  async function run() {
    setState({ status: "checking" });
    let result: CredentialResult;
    try {
      result = await onCheck();
    } catch (err) {
      result = { ok: false, error: errorMessage(err) };
    }
    setState({ status: "done", result, at: Date.now() });
  }

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <Button type="button" variant="outline" size="xs" disabled={disabled || state.status === "checking"} onClick={run}>
        {state.status === "checking" ? <Spinner /> : <PlugZapIcon />}
        {m.credentials_check()}
      </Button>
      {state.status === "done" &&
        (state.result.ok ? (
          <span className="inline-flex animate-fade-in items-center gap-1 text-success-foreground text-xs">
            <CircleCheckIcon className="size-3.5" />
            {m.credentials_valid()}
          </span>
        ) : (
          <span className="inline-flex min-w-0 animate-fade-in items-center gap-1 text-destructive-foreground text-xs">
            <CircleXIcon className="size-3.5 shrink-0" />
            <span className="break-all">{m.credentials_invalid({ error: describe(state.result.error) })}</span>
          </span>
        ))}
    </div>
  );
}
