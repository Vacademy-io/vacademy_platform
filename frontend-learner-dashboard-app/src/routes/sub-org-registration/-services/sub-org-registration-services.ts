import { BASE_URL } from "@/constants/urls";
import axios from "axios";
import type { PaymentInitiationRequest } from "./build-payment-initiation-request";

/**
 * PUBLIC (unauthenticated) sub-org self-registration API.
 * Base: /admin-core-service/open/v1/sub-org-registration — whitelisted via the
 * existing /open/** rule, so we use plain axios (NOT authenticatedAxiosInstance).
 */
const SUB_ORG_REGISTRATION_BASE = `${BASE_URL}/admin-core-service/open/v1/sub-org-registration`;

// ─── Template types ──────────────────────────────────────────────────────────

/**
 * Nested custom_field payload. The backend's nested CustomFieldDTO serializes
 * camelCase (same shape audience-response gets), but we tolerate snake_case
 * too so a future DTO naming change can't silently break the wizard.
 */
export interface TemplateCustomFieldInner {
  id: string;
  fieldKey?: string;
  field_key?: string;
  fieldName?: string;
  field_name?: string;
  fieldType?: string;
  field_type?: string;
  config?: string | null;
  formOrder?: number | null;
  form_order?: number | null;
  isMandatory?: boolean | null;
  is_mandatory?: boolean | null;
  individualOrder?: number | null;
  individual_order?: number | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

/** Outer InstituteCustomFieldDTO row (snake_case). */
export interface TemplateInstituteCustomField {
  id: string;
  field_id?: string | null;
  institute_id?: string;
  type?: string;
  type_id?: string;
  group_name?: string | null;
  custom_field: TemplateCustomFieldInner;
  individual_order?: number | null;
  group_internal_order?: number | null;
  status?: string | null;
}

/** One selectable plan on a paid template (snake_case from the backend). */
export interface TemplatePaymentPlan {
  id: string;
  name: string;
  actual_price: number;
  elevated_price: number | null;
  currency: string;
  validity_in_days: number | null;
  description: string | null;
}

/** Payment section of the template — null/absent for FREE templates. */
export interface TemplatePaymentInfo {
  type: "ONE_TIME" | "SUBSCRIPTION";
  vendor: string;
  currency: string;
  payment_plans: TemplatePaymentPlan[];
}

export interface SubOrgRegistrationTemplate {
  template_name: string;
  institute_id: string;
  /** May end with "PAYMENT" for paid templates (always the last step). */
  steps: string[];
  tnc_file_id: string | null;
  custom_fields: TemplateInstituteCustomField[];
  /** Null/absent for FREE templates. */
  payment?: TemplatePaymentInfo | null;
  /**
   * Identity documents verified via DigiLocker when `steps` includes "KYC" —
   * e.g. ["AADHAAR"] or ["AADHAAR","PAN"]. Null/absent when KYC is off.
   */
  kyc_documents?: string[] | null;
}

// ─── Flow request/response types ─────────────────────────────────────────────

export interface StartRegistrationRequest {
  institute_id: string;
  code: string;
  org_name: string;
  org_logo_file_id: string | null;
  admin_name: string;
  admin_email: string;
  admin_phone: string | null;
}

export interface StartRegistrationResponse {
  registration_id: string;
  status: string;
}

export interface CustomFieldValuePayload {
  custom_field_id: string;
  value: string;
}

export interface CompleteRegistrationRequest {
  registration_id: string;
  tnc_accepted: boolean;
  custom_field_values: CustomFieldValuePayload[];
  /** Paid templates only — the selected payment plan id. */
  plan_id?: string;
  /**
   * Paid templates only — the backend REJECTS /complete for a paid template
   * when this is missing. Same shape the enroll-by-invite flow builds.
   */
  payment_initiation_request?: PaymentInitiationRequest;
}

/** Gateway payload returned by /complete for paid templates. */
export interface CompletePaymentResponse {
  /** Payment-log id — poll payment completion status with this. */
  order_id: string;
  /**
   * Vendor-specific payload, e.g. paymentStatus, razorpayKeyId,
   * razorpayOrderId, amount, currency, redirectUrl.
   */
  response_data: Record<string, unknown>;
  status?: string;
  message?: string;
  payment_type?: string;
}

export interface CompleteRegistrationResponse {
  registration_id: string;
  /** "COMPLETED" for free templates; "PENDING_PAYMENT" for paid ones. */
  status: string;
  sub_org_id: string;
  admin_email: string;
  /** Paid templates only — used for the Cashfree user-plan-payment call. */
  user_plan_id?: string;
  payment_response?: CompletePaymentResponse;
}

// ─── KYC (DigiLocker identity verification) types ────────────────────────────

export type KycStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "VERIFIED"
  | "CONSENT_DENIED"
  | "EXPIRED"
  | "FAILED";

export interface StartKycResponse {
  registration_id: string;
  kyc_status: KycStatus;
  /**
   * DigiLocker consent URL. Expires in ~10 minutes — mint it on button click
   * (never on mount) and open it immediately.
   */
  url: string;
}

/** Extracted document details — present once kyc_status is VERIFIED. */
export interface KycSummary {
  name?: string | null;
  dob?: string | null;
  masked_aadhaar?: string | null;
  pan_number?: string | null;
  pan_name?: string | null;
}

export interface KycStatusResponse {
  registration_id: string;
  kyc_status: KycStatus;
  summary?: KycSummary | null;
}

// ─── API functions ───────────────────────────────────────────────────────────

export const getSubOrgRegistrationTemplate = async ({
  instituteId,
  code,
}: {
  instituteId: string;
  code: string;
}): Promise<SubOrgRegistrationTemplate> => {
  const response = await axios.get<SubOrgRegistrationTemplate>(
    `${SUB_ORG_REGISTRATION_BASE}/template`,
    { params: { instituteId, code } }
  );
  return response?.data;
};

/** react-query options for the template fetch (used with useSuspenseQuery). */
export const handleGetSubOrgRegistrationTemplate = ({
  instituteId,
  code,
}: {
  instituteId: string;
  code: string;
}) => {
  return {
    queryKey: ["GET_SUB_ORG_REGISTRATION_TEMPLATE", instituteId, code],
    queryFn: () => getSubOrgRegistrationTemplate({ instituteId, code }),
    staleTime: 60 * 60 * 1000,
    // Closed/invalid links come back as 4xx/5xx — surface the error page
    // immediately instead of retrying three times.
    retry: false,
  };
};

export const startSubOrgRegistration = async (
  payload: StartRegistrationRequest
): Promise<StartRegistrationResponse> => {
  const response = await axios.post<StartRegistrationResponse>(
    `${SUB_ORG_REGISTRATION_BASE}/start`,
    payload
  );
  return response?.data;
};

export const verifySubOrgRegistrationOtp = async ({
  registrationId,
  otp,
}: {
  registrationId: string;
  otp: string;
}): Promise<StartRegistrationResponse> => {
  const response = await axios.post<StartRegistrationResponse>(
    `${SUB_ORG_REGISTRATION_BASE}/verify-otp`,
    { registration_id: registrationId, otp }
  );
  return response?.data;
};

export const resendSubOrgRegistrationOtp = async ({
  registrationId,
}: {
  registrationId: string;
}): Promise<void> => {
  await axios.post(`${SUB_ORG_REGISTRATION_BASE}/resend-otp`, {
    registration_id: registrationId,
  });
};

export const completeSubOrgRegistration = async (
  payload: CompleteRegistrationRequest
): Promise<CompleteRegistrationResponse> => {
  const response = await axios.post<CompleteRegistrationResponse>(
    `${SUB_ORG_REGISTRATION_BASE}/complete`,
    payload
  );
  return response?.data;
};

/**
 * Mints a fresh DigiLocker consent URL for the registration's KYC step.
 * Each call creates a new verification attempt — safe to call again after
 * CONSENT_DENIED/EXPIRED/FAILED. `redirectUrl` must be https in production.
 */
export const startKyc = async (
  registrationId: string,
  redirectUrl: string
): Promise<StartKycResponse> => {
  const response = await axios.post<StartKycResponse>(
    `${SUB_ORG_REGISTRATION_BASE}/kyc/start`,
    { registration_id: registrationId, redirect_url: redirectUrl }
  );
  return response?.data;
};

/**
 * Current KYC status for the registration. Poll while PENDING — the backend
 * flips it to VERIFIED (fetching documents server-side) once the user
 * completes DigiLocker consent.
 */
export const getKycStatus = async (
  registrationId: string
): Promise<KycStatusResponse> => {
  const response = await axios.get<KycStatusResponse>(
    `${SUB_ORG_REGISTRATION_BASE}/kyc/status`,
    { params: { registrationId } }
  );
  return response?.data;
};

/**
 * Extracts a human-readable message from a backend error. VacademyException
 * responses carry the message in `ex` ({ url, ex, responseCode, date }); we
 * also tolerate `message`/`error` shapes, falling back to the provided text.
 */
export const getSubOrgApiErrorMessage = (
  error: unknown,
  fallback: string
): string => {
  const err = error as {
    response?: { data?: { ex?: string; message?: string; error?: string } };
  };
  return (
    err?.response?.data?.ex ||
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    fallback
  );
};
