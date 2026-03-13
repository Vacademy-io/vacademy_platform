// ─────────────────────────────────────────────────────────────
// Parent Portal — API Service Layer
// ─────────────────────────────────────────────────────────────

import { Preferences } from "@capacitor/preferences";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import type {
  ChildProfile,
  RegistrationFormData,
  RegistrationSavePayload,
  PaymentSummary,
  PaymentHistoryResponse,
  InitiatePaymentPayload,
  InitiatePaymentResponse,
  AdmissionOverview,
  AdmissionTimelineEvent,
  UserRole,
  StudentFeeDue,
  StudentFeeReceipt,
  DuesFilterBody,
} from "@/types/parent-portal";

// ── Helpers ────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_BACKEND_URL;
// Base URL for admin-core service (stage backend) used by dues/receipts APIs.
const ADMIN_CORE_BASE_URL = "https://backend-stage.vacademy.io";

async function getHeaders(): Promise<Record<string, string>> {
  const token = await getTokenFromStorage(TokenKey.accessToken);
  const instituteDetails = await Preferences.get({ key: "InstituteDetails" });
  const instituteId = instituteDetails.value
    ? JSON.parse(instituteDetails.value)?.id
    : "";

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-institute-id": instituteId,
  };
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = await getHeaders();
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(
      `API Error ${response.status}: ${response.statusText} — ${errorBody}`,
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ── Role Detection ─────────────────────────────────────────────

/**
 * Determines user role from JWT token authorities.
 * Called after login to decide routing destination.
 */
export async function detectUserRole(): Promise<UserRole> {
  try {
    const { getTokenDecodedData } = await import("@/lib/auth/sessionUtility");
    const token = await getTokenFromStorage(TokenKey.accessToken);
    if (!token) return "LEARNER"; // default fallback

    const decoded = getTokenDecodedData(token);
    const authorities = decoded?.authorities;

    if (!authorities) return "LEARNER";

    // Check roles across all institute authorities
    const allRoles: string[] = [];
    for (const instId of Object.keys(authorities)) {
      const instRoles = authorities[instId];
      if (Array.isArray(instRoles)) {
        allRoles.push(...instRoles);
      } else if (typeof instRoles === "object" && instRoles !== null) {
        // Could be { roles: [...] } structure
        const nested = (instRoles as { roles?: string[] }).roles;
        if (Array.isArray(nested)) allRoles.push(...nested);
      }
    }

    const upperRoles = allRoles.map((r) => r.toUpperCase());

    if (upperRoles.includes("PARENT")) return "PARENT";
    if (upperRoles.includes("ADMIN")) return "ADMIN";
    return "LEARNER";
  } catch (error) {
    console.error("[ParentAPI] Role detection failed:", error);
    return "LEARNER";
  }
}

// ── Child Profile ──────────────────────────────────────────────

/** Fetch single child profile by ID. */
export async function getChildProfile(childId: string): Promise<ChildProfile> {
  return apiRequest<ChildProfile>(`/parent-portal/children/${childId}`);
}

// ── Admission Overview ─────────────────────────────────────────

/** Fetch full admission overview for a child. */
export async function getAdmissionOverview(
  childId: string,
): Promise<AdmissionOverview> {
  return apiRequest<AdmissionOverview>(
    `/parent-portal/children/${childId}/admission-overview`,
  );
}

/** Fetch admission timeline events for a child. */
export async function getAdmissionTimeline(
  childId: string,
): Promise<AdmissionTimelineEvent[]> {
  return apiRequest<AdmissionTimelineEvent[]>(
    `/parent-portal/children/${childId}/timeline`,
  );
}

// ── Registration ───────────────────────────────────────────────

/** Get registration form structure and current data for a child. */
export async function getRegistrationForm(
  childId: string,
): Promise<RegistrationFormData> {
  return apiRequest<RegistrationFormData>(
    `/parent-portal/children/${childId}/registration`,
  );
}

/** Save (draft or submit) a registration form section. */
export async function saveRegistrationSection(
  payload: RegistrationSavePayload,
): Promise<RegistrationFormData> {
  return apiRequest<RegistrationFormData>(
    `/parent-portal/registration/${payload.registration_id}/sections/${payload.section_id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        fields: payload.fields,
        is_draft: payload.is_draft,
      }),
    },
  );
}

/** Submit completed registration form. */
export async function submitRegistration(
  registrationId: string,
): Promise<RegistrationFormData> {
  return apiRequest<RegistrationFormData>(
    `/parent-portal/registration/${registrationId}/submit`,
    { method: "POST" },
  );
}

// ── Application Stages ─────────────────────────────────────────

/** Fetch admission stages for a child. */
export async function getAdmissionStages(
  childId: string,
): Promise<AdmissionOverview> {
  return apiRequest<AdmissionOverview>(
    `/parent-portal/children/${childId}/admission-stages`,
  );
}

/** Fetch applicant stages for a child. */
export async function getApplicantStages(
  childId: string,
): Promise<AdmissionTimelineEvent[]> {
  return apiRequest<AdmissionTimelineEvent[]>(
    `/parent-portal/children/${childId}/applicant-stages`,
  );
}

// ── Payments ───────────────────────────────────────────────────

/** Get fee breakdown and payment summary for a child. */
export async function getPaymentSummary(
  childId: string,
): Promise<PaymentSummary> {
  return apiRequest<PaymentSummary>(
    `/parent-portal/children/${childId}/payments/summary`,
  );
}

/** Get payment transaction history. */
export async function getPaymentHistory(
  childId: string,
  page: number = 0,
  pageSize: number = 20,
): Promise<PaymentHistoryResponse> {
  return apiRequest<PaymentHistoryResponse>(
    `/parent-portal/children/${childId}/payments/history?page=${page}&size=${pageSize}`,
  );
}

/** Initiate a payment for selected fee items. */
export async function initiatePayment(
  payload: InitiatePaymentPayload,
): Promise<InitiatePaymentResponse> {
  return apiRequest<InitiatePaymentResponse>(
    `/parent-portal/payments/initiate`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/** Verify payment completion callback. */
export async function verifyPayment(
  paymentSessionId: string,
  gatewayPaymentId: string,
): Promise<{ status: string; message: string }> {
  return apiRequest(`/parent-portal/payments/verify`, {
    method: "POST",
    body: JSON.stringify({
      payment_session_id: paymentSessionId,
      gateway_payment_id: gatewayPaymentId,
    }),
  });
}

/** Download a payment receipt. */
export async function downloadReceipt(transactionId: string): Promise<Blob> {
  const headers = await getHeaders();
  const response = await fetch(
    `${BASE_URL}/parent-portal/payments/receipt/${transactionId}`,
    { headers },
  );
  if (!response.ok) throw new Error("Failed to download receipt");
  return response.blob();
}

// ── Student Fee Dues & Receipts ─────────────────────────────────

/** Fetch student fee dues/installments with optional filters. */
export async function getStudentDues(
  userId: string,
  instituteId: string,
  filters?: DuesFilterBody,
): Promise<StudentFeeDue[]> {
  const headers = await getHeaders();
  const response = await fetch(
    `${ADMIN_CORE_BASE_URL}/admin-core-service/v1/admin/student-fee/${userId}/dues?instituteId=${instituteId}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(filters || {}),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(
      `API Error ${response.status}: ${response.statusText} — ${errorBody}`,
    );
  }

  return response.json() as Promise<StudentFeeDue[]>;
}

/** Fetch student fee payment receipts/allocations. */
export async function getStudentReceipts(
  userId: string,
  instituteId: string,
): Promise<StudentFeeReceipt[]> {
  const headers = await getHeaders();
  const response = await fetch(
    `${ADMIN_CORE_BASE_URL}/admin-core-service/v1/admin/student-fee/${userId}/receipts?instituteId=${instituteId}`,
    {
      headers,
    },
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(
      `API Error ${response.status}: ${response.statusText} — ${errorBody}`,
    );
  }

  return response.json() as Promise<StudentFeeReceipt[]>;
}
