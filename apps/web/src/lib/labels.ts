import type { AttachmentKind, AttachmentStatus, ChatType, EventOutcome, Platform } from "@stash/shared";
import type { BadgeProps } from "#components/ui/badge";
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

const OUTCOME_LABELS: Record<EventOutcome, () => string> = {
  stored: () => m.outcome_stored(),
  duplicate: () => m.outcome_duplicate(),
  ignored: () => m.outcome_ignored(),
  validation: () => m.outcome_validation(),
  rejected: () => m.outcome_rejected(),
  error: () => m.outcome_error(),
};

const OUTCOME_VARIANTS: Record<EventOutcome, BadgeProps["variant"]> = {
  stored: "success",
  duplicate: "secondary",
  ignored: "outline",
  validation: "info",
  rejected: "warning",
  error: "error",
};

const STATUS_LABELS: Record<AttachmentStatus, () => string> = {
  pending: () => m.attachment_queued(),
  downloading: () => m.status_downloading(),
  stored: () => m.media_stored(),
  failed: () => m.media_failed(),
};

const STATUS_VARIANTS: Record<AttachmentStatus, BadgeProps["variant"]> = {
  pending: "secondary",
  downloading: "info",
  stored: "success",
  failed: "error",
};

const KIND_LABELS: Record<AttachmentKind, () => string> = {
  image: () => m.kind_image(),
  video: () => m.kind_video(),
  audio: () => m.kind_audio(),
  file: () => m.kind_file(),
};

export const platformLabel = (platform: Platform) => PLATFORM_LABELS[platform]?.() ?? platform;
export const chatTypeLabel = (type: ChatType) => CHAT_TYPE_LABELS[type]?.() ?? type;
export const outcomeLabel = (o: EventOutcome) => OUTCOME_LABELS[o]?.() ?? o;
export const outcomeVariant = (o: EventOutcome) => OUTCOME_VARIANTS[o] ?? "outline";
export const statusLabel = (s: AttachmentStatus) => STATUS_LABELS[s]?.() ?? s;
export const statusVariant = (s: AttachmentStatus) => STATUS_VARIANTS[s] ?? "outline";
export const kindLabel = (k: AttachmentKind) => KIND_LABELS[k]?.() ?? k;
