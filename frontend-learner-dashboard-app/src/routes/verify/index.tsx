import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Barcode, MagnifyingGlass } from "@phosphor-icons/react";
import { MyButton } from "@/components/design-system/button";
import { MyInput } from "@/components/design-system/input";
import {
  ErrorCard,
  InvalidCard,
  ValidCard,
  VerifyingCard,
} from "./-components/verification-cards";
import {
  verifyScannedCertificate,
  type VerificationResult,
} from "@/services/certificate-verification";

/**
 * Public "check a certificate" page.
 *
 * A QR scan opens a URL and lands straight on `/verify/$certificateId`. A
 * *barcode* scan cannot — a barcode scanner hands over text, not a link — and
 * neither can someone reading a printed certificate. Without this page a
 * barcode on a certificate verified nothing at all.
 *
 * Reachable without logging in: `/verify` is in the public-route allowlist in
 * use-domain-routing.ts (both copies).
 */
export const Route = createFileRoute("/verify/")({
  component: CertificateScanVerificationPage,
});

type PageState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "done"; result: VerificationResult };

function CertificateScanVerificationPage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<PageState>({ kind: "idle" });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const scanned = query.trim();
    if (!scanned) return;
    setState({ kind: "checking" });
    setState({ kind: "done", result: await verifyScannedCertificate(scanned) });
  };

  const result = state.kind === "done" ? state.result : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10 dark:bg-neutral-900">
      <div className="flex w-full max-w-md flex-col gap-6">
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:bg-neutral-800"
        >
          <div className="flex flex-col items-center gap-2 pb-5">
            <Barcode weight="fill" className="size-10 text-primary-500" />
            <h1 className="text-h3 font-semibold text-neutral-700 dark:text-neutral-100">
              Check a certificate
            </h1>
            <p className="text-center text-caption text-neutral-500">
              Scan the code on the certificate with any scanner app and paste
              what it gives you, or type the verification code printed beside it.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <MyInput
              inputType="text"
              label="Scanned code or verification link"
              inputPlaceholder="e.g. EDU2026001*A1B2C3D4E5"
              input={query}
              onChangeFunction={(e) => setQuery(e.target.value)}
              className="w-full font-mono"
              required
            />
            <MyButton
              type="submit"
              buttonType="primary"
              scale="large"
              layoutVariant="default"
              disable={!query.trim() || state.kind === "checking"}
              className="w-full"
            >
              <MagnifyingGlass className="mr-2 size-4" />
              {state.kind === "checking" ? "Checking…" : "Verify"}
            </MyButton>
          </div>

          {/* Said plainly, because someone who types only the number and gets
              nothing back will otherwise read it as "this certificate is fake". */}
          <p className="mt-4 border-t border-neutral-100 pt-4 text-caption text-neutral-400 dark:border-neutral-700">
            The certificate number on its own is not enough to verify — it has to
            be the scanned code or the verification code printed with it. This
            is what stops anyone guessing their way through an institute&apos;s
            certificates.
          </p>
        </form>

        {state.kind === "checking" && <VerifyingCard />}
        {result?.status === "valid" && <ValidCard data={result.data} />}
        {result?.status === "invalid" && (
          <InvalidCard>
            <p className="text-center text-body text-neutral-500">
              We have no record matching what you entered.
            </p>
          </InvalidCard>
        )}
        {result?.status === "error" && <ErrorCard />}
      </div>
    </main>
  );
}
