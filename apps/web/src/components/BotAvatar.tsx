import type { ComponentType, SVGProps } from "react";
import { BotIcon } from "lucide-react";
import type { Account, Platform } from "@stash/shared";
import { QQBotIcon } from "#components/icons/QQBotIcon";
import { cn } from "#lib/utils";

const PLATFORM_ICONS: Record<Platform, ComponentType<SVGProps<SVGSVGElement>>> = {
  qq: QQBotIcon,
};

interface Props {
  /** The bot, when known; its own picture wins over the platform icon. */
  account?: Pick<Account, "avatarUrl" | "name"> | null;
  platform: Platform;
  className?: string;
}

/** A bot's picture, or its platform's icon when it has none. Size it with className (default size-6). */
export function BotAvatar({ account, platform, className }: Props) {
  const Icon = PLATFORM_ICONS[platform] ?? BotIcon;
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-foreground/80",
        className,
      )}
    >
      {account?.avatarUrl ? (
        <img src={account.avatarUrl} alt={account.name} className="size-full object-cover" />
      ) : (
        <Icon className="size-[62%]" />
      )}
    </span>
  );
}
