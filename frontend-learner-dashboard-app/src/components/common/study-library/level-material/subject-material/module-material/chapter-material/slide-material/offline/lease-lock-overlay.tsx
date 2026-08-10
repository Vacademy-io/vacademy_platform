/**
 * Offline lease-expired / revoked lock overlay (plan §B6/§B7). Sibling of
 * `requires-internet-slide.tsx` — same layout language, different copy and
 * icon per `LockReason` (see `src/lib/offline/resolve.ts`).
 */

import { LockKey, Prohibit } from "@phosphor-icons/react";
import type { LockReason } from "@/lib/offline/resolve";

const COPY: Record<LockReason, { title: string; body: string }> = {
  LEASE_EXPIRED: {
    title: "Connect to the internet to keep offline access",
    body: "This device periodically re-validates offline content. Reconnect briefly to renew access and keep viewing this course offline.",
  },
  REVOKED: {
    title: "Offline access removed",
    body: "Your institute revoked offline access for this device. Reconnect to see what's still available.",
  },
};

export const LeaseLockOverlay = ({ reason }: { reason: LockReason }) => {
  const { title, body } = COPY[reason];
  const Icon = reason === "REVOKED" ? Prohibit : LockKey;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-neutral-100">
        <Icon size={32} className="text-neutral-400" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-title font-semibold text-neutral-700">{title}</p>
        <p className="max-w-sm text-body text-neutral-500">{body}</p>
      </div>
    </div>
  );
};
