import { SealWarning, WifiSlash } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * The not-verified cards both verification entry points share — the QR landing
 * page (`/verify/$certificateId`) and the scan/paste page (`/verify`).
 *
 * They live here rather than in either route because the two must agree: an
 * employer who scans and an employer who types the code are looking at the same
 * certificate, and any difference in wording between the two reads as one of
 * them being the "real" check.
 *
 * <p>A *successful* verification is not rendered here — it gets the institute's
 * own attestation template instead. See VerifiedByCertificate.
 */

export function Shell({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "success" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-6 shadow-sm dark:bg-neutral-800",
        tone === "success" && "border-success-200",
        tone === "danger" && "border-danger-200",
        tone === "neutral" && "border-neutral-200",
      )}
    >
      {children}
    </div>
  );
}

export function VerifyingCard() {
  return (
    <Shell tone="neutral">
      <div className="flex flex-col items-center gap-3 py-6">
        <div
          className="size-8 animate-spin rounded-full border-2 border-neutral-200 border-t-primary-500 motion-reduce:animate-none"
          role="status"
          aria-label="Checking certificate"
        />
        <p className="text-body text-neutral-500">Checking this certificate…</p>
      </div>
    </Shell>
  );
}

export function InvalidCard({
  certificateId,
  children,
}: {
  /** Omitted on the scan page, where there may be no recognisable number. */
  certificateId?: string;
  children?: React.ReactNode;
}) {
  return (
    <Shell tone="danger">
      <div className="flex flex-col items-center gap-2 pb-4">
        <SealWarning weight="fill" className="size-10 text-danger-500" />
        <h1 className="text-h3 font-semibold text-neutral-700 dark:text-neutral-100">
          Could not verify this certificate
        </h1>
      </div>
      {children ?? (
        <p className="text-center text-body text-neutral-500">
          We have no record of certificate{" "}
          <span className="font-mono text-neutral-700 dark:text-neutral-200">
            {certificateId}
          </span>{" "}
          with this verification link.
        </p>
      )}
      <p className="mt-4 text-center text-caption text-neutral-400">
        Links must be scanned or copied in full — a partial link will not verify.
        If you typed it by hand, scan the code on the certificate instead.
      </p>
    </Shell>
  );
}

export function ErrorCard() {
  return (
    <Shell tone="neutral">
      <div className="flex flex-col items-center gap-2 pb-4">
        <WifiSlash weight="fill" className="size-10 text-neutral-400" />
        <h1 className="text-h3 font-semibold text-neutral-700 dark:text-neutral-100">
          Could not reach the verification service
        </h1>
      </div>
      {/* Deliberately not "invalid" — a dropped connection must never make a
          genuine certificate look fake. */}
      <p className="text-center text-body text-neutral-500">
        This does not mean the certificate is invalid. Check your connection and
        try again.
      </p>
    </Shell>
  );
}
