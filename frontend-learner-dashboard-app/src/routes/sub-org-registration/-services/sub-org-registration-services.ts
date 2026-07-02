import { BASE_URL } from "@/constants/urls";
import axios from "axios";

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

export interface SubOrgRegistrationTemplate {
  template_name: string;
  institute_id: string;
  steps: string[];
  tnc_file_id: string | null;
  custom_fields: TemplateInstituteCustomField[];
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
}

export interface CompleteRegistrationResponse {
  registration_id: string;
  status: string;
  sub_org_id: string;
  admin_email: string;
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
