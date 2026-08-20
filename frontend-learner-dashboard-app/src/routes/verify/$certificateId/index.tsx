import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { verifyCertificate, type VerificationResult } from "@/services/certificate-verification";
import {
  ErrorCard,
  InvalidCard,
  VerifyingCard,
} from "../-components/verification-cards";
import { VerifiedByCertificate } from "../-components/verified-by-certificate";

/**
 * Public certificate verification page — where a scanned certificate QR lands.
 *
 * <p>Renders the institute's own attestation template rather than an app
 * screen: this is opened by strangers judging a document, and "verified by
 * <institute>" over the institute's mark is the thing that answers their
 * question. See VerifiedByCertificate.
 *
 * <p>Served from the institute's learner portal, so a white-labelled school
 * sends its graduates' verifiers to its own domain — the QR is built as
 * `<learnerPortalBaseUrl>/verify/<number>?t=<token>` in
 * CertificateVerificationService.buildVerificationUrl.
 *
 * Reachable without logging in. `/verify` is in the public-route allowlist in
 * use-domain-routing.ts (both copies), so domain routing does not bounce an
 * anonymous visitor to the courses page.
 */
export const Route = createFileRoute("/verify/$certificateId/")({
  component: CertificateVerificationPage,
});

function CertificateVerificationPage() {
  const { certificateId } = Route.useParams();
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    // The credential lives in ?t= (the QR's long token) or ?c= (the barcode's
    // short code). The number alone is deliberately not enough, since
    // certificate numbers are sequential and would be enumerable.
    const params = new URLSearchParams(window.location.search);
    const credential = params.get("t") ?? params.get("c");
    let cancelled = false;
    void verifyCertificate(certificateId, credential).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [certificateId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10 dark:bg-neutral-900">
      <div className="w-full max-w-xl">
        {result === null && <VerifyingCard />}
        {result?.status === "valid" && (
          <VerifiedByCertificate data={result.data} verifiedVia="QR code" />
        )}
        {result?.status === "invalid" && (
          <>
            <InvalidCard certificateId={certificateId} />
            {/* A link that was truncated in an email, or a number typed by
                hand, both land here. Sending them to the scan page is the one
                thing that can still verify the certificate. */}
            <p className="mt-4 text-center text-caption text-neutral-500">
              <Link
                to="/verify"
                className="font-medium text-primary-500 underline underline-offset-2"
              >
                Enter the code from the certificate instead
              </Link>
            </p>
          </>
        )}
        {result?.status === "error" && <ErrorCard />}
      </div>
    </main>
  );
}
