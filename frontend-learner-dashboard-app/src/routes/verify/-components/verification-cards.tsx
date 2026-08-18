import { CheckCircle, SealWarning, WifiSlash } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { VerificationResult } from "@/services/certificate-verification";

/**
 * The result cards both verification entry points share — the QR landing page
 * (`/verify/$certificateId`) and the scan/paste page (`/verify`).
 *
 * They live here rather than in either route because the two must agree: an
 * employer who scans and an employer who types the code are looking at the same
 * certificate, and any difference in wording between the two reads as one of
 * them being the "real" check.
 */

export type ValidVerification = Extract<
  VerificationResult,
  { status: "valid" }
>["data"];

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

export function ValidCard({ data }: { data: ValidVerification }) {
  const issued = data.issued_at ? new Date(data.issued_at) : null;

  return (
    <Shell tone="success">
      <div className="flex flex-col items-center gap-2 border-b border-neutral-100 pb-5 dark:border-neutral-700">
        <CheckCircle weight="fill" className="size-10 text-success-500" />
        <h1 className="text-h3 font-semibold text-neutral-700 dark:text-neutral-100">
          Verified certificate
        </h1>
        <p className="text-center text-caption text-neutral-500">
          This certificate was issued by{" "}
          {data.institute_name || "the institute"} and is genuine.
        </p>
      </div>

      <dl className="flex flex-col gap-3 pt-5">
        <Row label="Issued to" value={data.learner_name || "—"} />
        <Row label="Course" value={data.course_name || "—"} />
        <Row label="Certificate number" value={data.certificate_id} mono />
        <Row
          label="Issued on"
          value={
            issued
              ? issued.toLocaleDateString(undefined, { dateStyle: "long" })
              : "—"
          }
        />
        {typeof data.completion_percentage === "number" && (
          <Row label="Completion" value={`${data.completion_percentage}%`} />
        )}
      </dl>

      {/* Says plainly why the name is partial, so it doesn't read as a bug. */}
      <p className="mt-5 border-t border-neutral-100 pt-4 text-caption text-neutral-400 dark:border-neutral-700">
        The recipient&apos;s name is shown partially to protect their privacy. It
        matches the name printed on the certificate.
      </p>
    </Shell>
  );
}

export function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-caption text-neutral-400">{label}</dt>
      <dd
        className={cn(
          "text-right text-body font-medium text-neutral-700 dark:text-neutral-100",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
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
