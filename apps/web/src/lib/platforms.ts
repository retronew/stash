import type { ComponentType, SVGProps } from "react";
import { PLATFORMS, type Platform } from "@stash/shared";
import { QQBotIcon } from "#components/icons/QQBotIcon";
import { m } from "#lib/i18n";

// Everything the web app knows about a chat platform. Pages stay generic and
// read from here; adding a platform means adding an entry (plus its adapter
// in apps/api/src/platforms/).

export interface PlatformInfo {
  id: Platform;
  label: () => string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Where bots are created and the webhook URL is set. */
  consoleUrl: string;
  /** Names of the two credentials as the platform's console calls them. */
  credentials: { id: () => string; secret: () => string };
  /** How to connect a bot, step by step. */
  steps: (() => string)[];
}

const INFO: Record<Platform, PlatformInfo> = {
  qq: {
    id: "qq",
    label: () => m.platform_qq(),
    icon: QQBotIcon,
    consoleUrl: "https://q.qq.com",
    credentials: { id: () => "AppID", secret: () => "AppSecret" },
    steps: [() => m.platform_qq_step_create(), () => m.platform_qq_step_webhook(), () => m.platform_qq_step_events()],
  },
};

export const platformInfo = (platform: Platform): PlatformInfo => INFO[platform];

/** Every supported platform, in display order. */
export const platformList = (): PlatformInfo[] => PLATFORMS.map((p) => INFO[p]);
