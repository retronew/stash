import type { Platform } from "@stash/shared";
import type { PlatformAdapter } from "#platforms/types";
import { qqAdapter } from "#platforms/qq/adapter";

const ADAPTERS: Record<Platform, PlatformAdapter> = {
  qq: qqAdapter,
};

export function adapterFor(platform: Platform): PlatformAdapter {
  return ADAPTERS[platform];
}
