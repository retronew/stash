import type { ChatType, Platform } from "@stash/shared";
import { m } from "#lib/i18n";

const PLATFORM_LABELS: Record<Platform, () => string> = {
  qq: () => m.platform_qq(),
};

const CHAT_TYPE_LABELS: Record<ChatType, () => string> = {
  c2c: () => m.chat_c2c(),
  group: () => m.chat_group(),
  channel: () => m.chat_channel(),
  dm: () => m.chat_dm(),
};

export const platformLabel = (platform: Platform) => PLATFORM_LABELS[platform]?.() ?? platform;
export const chatTypeLabel = (type: ChatType) => CHAT_TYPE_LABELS[type]?.() ?? type;
