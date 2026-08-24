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
  /**
   * Institute branding, so the verification page can present itself as the
   * institute's own. It travels on the response because whoever scans a
   * certificate is not logged in and may be on any domain — there is no
   * institute context on the page to resolve branding from.
   */
  institute_logo_file_id?: string | null;
  institute_theme_code?: string | null;
  institute_website?: string | null;
  /**
   * What this scan should present: 'PAGE' (default) or 'DOCUMENT'.
   *
   * Resolved server-side, so an institute that switched to DOCUMENT but never
   * finished designing one still reports PAGE — verification must never
   * dead-end on half-finished configuration.
   */
  verification_mode?: "PAGE" | "DOCUMENT" | null;
  /** Which kind of document {@link document_url} points at. */
  document_type?: "HTML" | "PDF" | null;
  /**
   * Where the document lives, when verification_mode is 'DOCUMENT'.
   *
   * PDF -> an absolute, permanent media URL; open as-is.
   * HTML -> a path on the API, NOT on this portal. It must be prefixed with
   * BASE_URL: the scan lands on the institute's own domain while the API lives
   * elsewhere, so treating it as same-origin would 404.
   */
  document_url?: string | null;
  /** A line the institute chose to show here, or nothing. */
  institute_note?: string | null;
  /**
   * How the institute set this page up. Null on any field means the shipped
   * default — the page must read the same for an institute that never
   * configured it as it did before any of this existed.
   */
  headline?: string | null;
  show_course?: boolean | null;
  show_issue_date?: boolean | null;
  show_completion?: boolean | null;
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
