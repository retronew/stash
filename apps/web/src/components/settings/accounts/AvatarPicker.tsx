import { useRef, useState } from "react";
import { ImageUpIcon, XIcon } from "lucide-react";
import type { Account } from "@stash/shared";
import { BotAvatar } from "#components/BotAvatar";
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "#components/ui/tooltip";
import { toastError } from "#lib/api";
import { m } from "#lib/i18n";

const MAX_BYTES = 2 * 1024 * 1024;

interface Props {
  account: Account;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}

/** The bot's picture: click to upload one, × to go back to the platform icon. */
export function AvatarPicker({ account, onUpload, onRemove }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      toastError(m.avatar_failed(), err, { id: "avatar" });
    } finally {
      setBusy(false);
    }
  }

  function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toastError(m.avatar_failed(), new Error(m.avatar_too_large()), { id: "avatar" });
      return;
    }
    run(() => onUpload(file));
  }

  return (
    <div className="relative shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              disabled={busy}
              aria-label={m.avatar_change()}
              className="group relative block cursor-pointer rounded-full"
              onClick={() => input.current?.click()}
            />
          }
        >
          <BotAvatar account={account} platform={account.platform} className="size-10" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {busy ? <Spinner className="size-4" /> : <ImageUpIcon className="size-4" />}
          </span>
        </TooltipTrigger>
        <TooltipPopup>{m.avatar_change()}</TooltipPopup>
      </Tooltip>
      {account.avatarUrl && !busy && (
        <Button
          variant="outline"
          size="icon-xs"
          aria-label={m.avatar_remove()}
          className="-end-1.5 -top-1.5 absolute size-5 rounded-full sm:size-5"
          onClick={() => run(onRemove)}
        >
          <XIcon className="size-3" />
        </Button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
