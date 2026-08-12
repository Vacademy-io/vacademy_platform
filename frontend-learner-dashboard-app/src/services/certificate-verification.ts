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
 * Both the number and the token are required. A wrong token and an unknown
 * number both come back 404 — indistinguishable on purpose, so the sequential
 * numbers cannot be probed.
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

    if (response.status === 404) return { status: "invalid" };
    if (!response.ok) return { status: "error" };

    const data = (await response.json()) as CertificateVerification;
    return data?.valid ? { status: "valid", data } : { status: "invalid" };
  } catch {
    // Network failure is NOT the same as an invalid certificate — telling
    // someone their genuine certificate is fake because their wifi dropped
    // would be worse than saying nothing.
    return { status: "error" };
  }
}
