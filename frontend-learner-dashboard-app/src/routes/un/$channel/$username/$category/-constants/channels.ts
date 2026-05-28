import { Envelope, ChatCircle, type Icon } from "@phosphor-icons/react";

import type { UnsubscribeRequest } from "@/services/unsubscribe/unsubscribe-service";

export type ChannelKey = "em" | "wp";

export interface ChannelDescriptor {
  key: ChannelKey;
  label: string;
  channel: UnsubscribeRequest["channel"];
  icon: Icon;
}

export const SUPPORT_EMAIL = "support@vacademy.com";

const CHANNEL_CONFIG: Record<ChannelKey, ChannelDescriptor> = {
  em: {
    key: "em",
    label: "Email",
    channel: "EMAIL",
    icon: Envelope,
  },
  wp: {
    key: "wp",
    label: "WhatsApp",
    channel: "WHATSAPP",
    icon: ChatCircle,
  },
};

export const resolveChannel = (key: string | undefined) => {
  if (!key) return null;
  const normalized = key.toLowerCase() as ChannelKey;
  return CHANNEL_CONFIG[normalized] ?? null;
};

