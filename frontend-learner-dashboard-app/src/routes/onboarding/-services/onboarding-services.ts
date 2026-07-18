import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "@/constants/urls";

/**
 * Learner-facing Onboarding API client.
 *
 * These endpoints are learner-scoped: the backend resolves "who is asking"
 * from the JWT (`@RequestParam("user") CustomUserDetails`) server-side, so we
 * never send a subject/user id from here — only `instituteId` where required.
 * See admin_core_service `LearnerOnboardingController`.
 */
const ONBOARDING_BASE = `${BASE_URL}/admin-core-service/learner/onboarding`;
const CUSTOM_FIELDS_BASE = `${BASE_URL}/admin-core-service/common/custom-fields`;

export type OnboardingInstanceStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ABANDONED"
  | "CANCELLED";

export type OnboardingStepStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED";

/** v1 has exactly one step type. Kept as a union so future types type-check cleanly. */
export type OnboardingStepType = "FORM" | (string & {});

export interface OnboardingStepInstanceDTO {
  id: string;
  onboarding_instance_id: string;
  step_id: string;
  step_name: string;
  step_type: OnboardingStepType;
  status: OnboardingStepStatus;
  entered_at: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
  skip_reason: string | null;
}

export interface OnboardingInstanceDTO {
  id: string;
  flow_id: string;
  institute_id: string;
  subject_user_id: string;
  current_step_id: string | null;
  status: OnboardingInstanceStatus;
  started_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  step_instances: OnboardingStepInstanceDTO[];
}

/** Fetches every onboarding instance in progress (or completed) for the caller. */
export const getMyOnboardingInstances = async (
  instituteId: string
): Promise<OnboardingInstanceDTO[]> => {
  const response = await authenticatedAxiosInstance.get<OnboardingInstanceDTO[]>(
    `${ONBOARDING_BASE}/instances`,
    { params: { instituteId } }
  );
  return Array.isArray(response?.data) ? response.data : [];
};

export const getStepInstance = async (
  stepInstanceId: string
): Promise<OnboardingStepInstanceDTO> => {
  const response = await authenticatedAxiosInstance.get<OnboardingStepInstanceDTO>(
    `${ONBOARDING_BASE}/step-instances/${stepInstanceId}`
  );
  return response.data;
};

/**
 * Submits a FORM step. `payload` is keyed by institute_custom_field_id.
 * The server re-validates mandatory fields and per-field edit permission on
 * every submit — a rejected submission (e.g. missing mandatory field) throws
 * (HTTP 400), it is NOT reflected as a non-2xx `data` shape. Callers must
 * catch and surface `getOnboardingApiErrorMessage(error, ...)`.
 */
export const submitStepInstance = async (
  stepInstanceId: string,
  payload: Record<string, string>
): Promise<OnboardingStepInstanceDTO> => {
  const response = await authenticatedAxiosInstance.post<OnboardingStepInstanceDTO>(
    `${ONBOARDING_BASE}/step-instances/${stepInstanceId}/submit`,
    { payload }
  );
  return response.data;
};

/**
 * One `institute_custom_fields` mapping row. The OUTER row is
 * `InstituteCustomFieldDTO`, which is `@JsonNaming(SnakeCaseStrategy)` —
 * snake_case. Its nested `custom_field` (`CustomFieldDTO`) has NO such
 * annotation, so Jackson serializes it with its declared (camelCase) field
 * names — same quirk already documented for the sub-org-registration
 * template fetch and the admin app's `InstituteDefaultField.custom_field`.
 */
export interface OnboardingCustomFieldInner {
  id: string;
  fieldKey: string;
  fieldName: string;
  fieldType: string;
  defaultValue: string | null;
  config: string | null;
  formOrder: number | null;
  isMandatory: boolean | null;
  isFilter: boolean | null;
  isSortable: boolean | null;
  isHidden: boolean | null;
  groupName: string | null;
  groupInternalOrder: number | null;
  individualOrder: number | null;
}

export interface OnboardingCustomFieldDTO {
  id: string;
  field_id: string | null;
  institute_id: string;
  type: string;
  type_id: string;
  group_name: string | null;
  custom_field: OnboardingCustomFieldInner | null;
  individual_order: number | null;
  group_internal_order: number | null;
  /** Mapping-level mandatory override — takes precedence over custom_field.isMandatory. */
  is_mandatory: boolean | null;
  status: string | null;
}

/**
 * Fields configured for one FORM step, via the generic feature-fields lookup
 * (type=ONBOARDING_STEP, typeId=stepId).
 *
 * KNOWN v1 GAP: this endpoint does not filter by the learner's role-based
 * view/edit permission for the field — it returns every field mapped to the
 * step regardless of who's asking. The backend still enforces edit
 * permission server-side on submit, but the frontend can't yet pre-filter
 * which fields to hide or disable for view-only fields. For v1 we render
 * every field as an editable text input and let the server reject/accept on
 * submit. A future "resolved step fields" endpoint should replace this call.
 */
export const getOnboardingStepFields = async (
  instituteId: string,
  stepId: string
): Promise<OnboardingCustomFieldDTO[]> => {
  const response = await authenticatedAxiosInstance.get<OnboardingCustomFieldDTO[]>(
    `${CUSTOM_FIELDS_BASE}/feature-fields`,
    { params: { instituteId, type: "ONBOARDING_STEP", typeId: stepId } }
  );
  return Array.isArray(response?.data) ? response.data : [];
};

/**
 * Extracts a human-readable message from a backend error. VacademyException
 * responses carry the message in `ex` ({ url, ex, responseCode, date }); we
 * also tolerate `message`/`error` shapes, falling back to the provided text.
 */
export const getOnboardingApiErrorMessage = (
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
