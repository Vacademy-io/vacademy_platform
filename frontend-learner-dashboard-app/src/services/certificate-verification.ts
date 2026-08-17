import { BASE_URL } from "@/constants/urls";

/**
 * Public certificate verification — what a scanned QR resolves to.
 *
 * Deliberately uses a plain fetch rather than the authenticated axios instance:
 * whoever scans a certificate is almost never logged in, and attaching an
 * interceptor that redirects to login on 401 would defeat the whole point.
 */
export const VERIFY_CERTIFICATE_URL = `${BASE_URL}/admin-core-service/open/v1/certificate/verify`;

export interface CertificateVerification {
  valid: boolean;
  certificate_id: string;
  institute_name: string;
  course_name: string;
  issued_at: string;
  completion_percentage: number | null;
  /** Masked, e.g. "A··· S·····" — never the learner's full name. */
  learner_name: string;
}

export type VerificationResult =
  | { status: "valid"; data: CertificateVerification }
  | { status: "invalid" }
  | { status: "error" };

/**
 * Shared response handling. A 404 means "we have no record matching this" — a
 * wrong credential and an unknown number are deliberately indistinguishable, so
 * the sequential numbers cannot be probed.
 */
async function readVerification(response: Response): Promise<VerificationResult> {
  if (response.status === 404) return { status: "invalid" };
  if (!response.ok) return { status: "error" };

  const data = (await response.json()) as CertificateVerification;
  return data?.valid ? { status: "valid", data } : { status: "invalid" };
}

/**
 * The number plus a credential are both required. The credential is either the
 * QR's long token (`?t=`) or the barcode's short code (`?c=`); the backend tries
 * the value as both, so the caller does not have to know which it holds.
 */
export async function verifyCertificate(
  certificateId: string,
  token: string | null,
): Promise<VerificationResult> {
  if (!certificateId || !token) return { status: "invalid" };

  try {
    const response = await fetch(
      `${VERIFY_CERTIFICATE_URL}/${encodeURIComponent(certificateId)}?t=${encodeURIComponent(token)}`,
      { headers: { Accept: "application/json" } },
    );
    return await readVerification(response);
  } catch {
    // Network failure is NOT the same as an invalid certificate — telling
    // someone their genuine certificate is fake because their wifi dropped
    // would be worse than saying nothing.
    return { status: "error" };
  }
}

/**
 * Verify from whatever a scanner produced.
 *
 * A QR scan opens a URL and lands on the page directly. A *barcode* scan just
 * yields text, so this is the path that makes a barcode verifiable at all: it
 * accepts a verification URL, the `NUMBER*CODE` a barcode encodes, or a bare
 * short code. A bare certificate number is deliberately not enough.
 */
export async function verifyScannedCertificate(
  scanned: string,
): Promise<VerificationResult> {
  const query = scanned.trim();
  if (!query) return { status: "invalid" };

  try {
    const response = await fetch(
      `${VERIFY_CERTIFICATE_URL}?q=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" } },
    );
    return await readVerification(response);
  } catch {
    return { status: "error" };
  }
}
