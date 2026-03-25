// ─────────────────────────────────────────────────────────────
// Parent Portal — Type Definitions
// ─────────────────────────────────────────────────────────────

// ======================== ROLE & AUTH ========================

export type UserRole = "ADMIN" | "LEARNER" | "PARENT";

export interface ParentUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_file_id?: string;
  institute_id: string;
  role: "PARENT";
  created_at: string;
  updated_at: string;
}

// ======================== CHILD / STUDENT ========================

export type AdmissionStatus =
  | "INQUIRY_SUBMITTED"
  | "INQUIRY_REVIEWED"
  | "REGISTRATION_PENDING"
  | "REGISTRATION_IN_PROGRESS"
  | "REGISTRATION_SUBMITTED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_COMPLETED"
  | "ASSESSMENT_SCHEDULED"
  | "ASSESSMENT_COMPLETED"
  | "ADMISSION_OFFERED"
  | "ADMISSION_ACCEPTED"
  | "PAYMENT_PENDING"
  | "PAYMENT_PARTIAL"
  | "PAYMENT_COMPLETED"
  | "DOCUMENTS_PENDING"
  | "DOCUMENTS_SUBMITTED"
  | "DOCUMENTS_VERIFIED"
  | "ENROLLED"
  | "REJECTED"
  | "WITHDRAWN";

export interface ChildProfile {
  id: string;
  student_id: string;
  parent_id: string;
  full_name: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  avatar_file_id?: string;
  grade_applying?: string;
  academic_year?: string;
  admission_status: AdmissionStatus;
  applicant_id?: string;
  inquiry_id?: string;
  registration_id?: string;
  institute_id: string;
  institute_name?: string;
  batch_name?: string;
  /** Package-session the applicant is targeting — used to prefill & lock the form */
  destinationPackageSessionId?: string;
  created_at: string;
  updated_at: string;
}

export interface ChildProfileListResponse {
  children: ChildProfile[];
  total_count: number;
  parent_name: string;
}

// ======================== INQUIRY ========================

export interface InquirySubmission {
  id: string;
  child_name: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  grade_applying: string;
  academic_year: string;
  inquiry_source: string;
  status: "SUBMITTED" | "REVIEWED" | "ACCEPTED" | "REJECTED";
  notes?: string;
  submitted_at: string;
  reviewed_at?: string;
}

// ======================== REGISTRATION ========================

export interface RegistrationFormSection {
  id: string;
  section_name: string;
  section_order: number;
  fields: RegistrationFormField[];
  is_completed: boolean;
}

export interface RegistrationFormField {
  id: string;
  field_name: string;
  field_label: string;
  field_type:
    | "TEXT"
    | "NUMBER"
    | "EMAIL"
    | "PHONE"
    | "DATE"
    | "SELECT"
    | "MULTI_SELECT"
    | "TEXTAREA"
    | "FILE"
    | "CHECKBOX"
    | "RADIO";
  is_required: boolean;
  placeholder?: string;
  options?: string[];
  validation_regex?: string;
  max_length?: number;
  value?: string | string[];
  error?: string;
  section_id: string;
}

export interface RegistrationFormData {
  id: string;
  child_id: string;
  institute_id: string;
  form_title: string;
  total_sections: number;
  completed_sections: number;
  current_section: number;
  sections: RegistrationFormSection[];
  status: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED" | "REJECTED";
  last_saved_at?: string;
  submitted_at?: string;
}

export interface RegistrationSavePayload {
  registration_id: string;
  section_id: string;
  fields: { field_id: string; value: string | string[] }[];
  is_draft: boolean;
}

// ======================== INTERVIEW & ASSESSMENT ========================

export interface InterviewSchedule {
  id: string;
  child_id: string;
  schedule_date: string;
  schedule_time: string;
  duration_minutes: number;
  location?: string;
  meeting_link?: string;
  interviewer_name?: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";
  notes?: string;
  result?: "PASS" | "FAIL" | "PENDING";
}

export interface AssessmentSchedule {
  id: string;
  child_id: string;
  assessment_name: string;
  schedule_date: string;
  schedule_time: string;
  duration_minutes: number;
  location?: string;
  assessment_type: "WRITTEN" | "ORAL" | "PRACTICAL" | "ONLINE";
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  score?: number;
  max_score?: number;
  result?: "PASS" | "FAIL" | "PENDING";
  feedback?: string;
}

// ======================== PAYMENTS ========================

export type PaymentCategory =
  | "REGISTRATION"
  | "ADMISSION"
  | "TUITION"
  | "HOSTEL"
  | "MESS"
  | "LIBRARY"
  | "TRANSPORT"
  | "UNIFORM"
  | "ADDITIONAL";

export type PaymentStatus =
  | "PENDING"
  | "PARTIAL"
  | "COMPLETED"
  | "OVERDUE"
  | "REFUNDED"
  | "WAIVED";

export interface PaymentFeeItem {
  id: string;
  category: PaymentCategory;
  description: string;
  amount: number;
  discount?: number;
  tax?: number;
  total: number;
  due_date?: string;
  status: PaymentStatus;
}

export interface PaymentSummary {
  child_id: string;
  total_fees: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  currency: string;
  fee_items: PaymentFeeItem[];
}

export interface PaymentTransaction {
  id: string;
  child_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  transaction_id: string;
  category: PaymentCategory;
  status: "SUCCESS" | "FAILED" | "PENDING" | "REFUNDED";
  paid_at: string;
  receipt_url?: string;
  receipt_file_id?: string;
  gateway_response?: string;
}

export interface PaymentHistoryResponse {
  transactions: PaymentTransaction[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface InitiatePaymentPayload {
  child_id: string;
  fee_item_ids: string[];
  payment_method: string;
  amount: number;
}

export interface InitiatePaymentResponse {
  payment_session_id: string;
  gateway_order_id: string;
  gateway_url?: string;
  amount: number;
  currency: string;
}

export interface StudentFeeDue {
  id: string;
  user_plan_id: string;
  cpo_id: string;
  cpo_name?: string;
  fee_type_name?: string;
  fee_type_code?: string;
  fee_type_description?: string;
  amount_expected: number;
  discount_amount: number;
  discount_reason: string | null;
  amount_paid: number;
  due_date: string;
  status: string;
  amount_due: number;
  is_overdue: boolean;
  days_overdue: number | null;
}

/** @deprecated Use InvoiceReceipt instead - kept for backward compatibility */
export interface StudentFeeReceipt {
  id: string;
  payment_log_id: string;
  student_fee_payment_id: string;
  cpo_name?: string;
  fee_type_name?: string;
  fee_type_code?: string;
  fee_type_description?: string;
  amount_allocated: number;
  allocation_type: string;
  remarks: string;
  created_at: string;
}

export interface InvoiceLineItem {
  line_item_id: string;
  item_type: string;
  description: string;
  amount: number | null;
  source_id: string;
  fee_type_name?: string;
  fee_type_code?: string;
  cpo_name?: string;
}

export interface InvoiceReceipt {
  invoice_id: string;
  invoice_number: string;
  total_amount: number | null;
  currency: string;
  status: string;
  pdf_file_id: string | null;
  type: string;
  invoice_date: string;
  created_at: string;
  amount_paid_now: number | null;
  total_paid: number | null;
  balance_due: number | null;
  total_discount: number | null;
  total_expected: number | null;
  line_items: InvoiceLineItem[];
}

export interface DuesFilterBody {
  status?: string;
  startDueDate?: string;
  endDueDate?: string;
}

// ======================== DOCUMENTS ========================

export type DocumentStatus =
  | "NOT_UPLOADED"
  | "UPLOADED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface DocumentRequirement {
  id: string;
  document_name: string;
  document_type: string;
  description?: string;
  is_required: boolean;
  allowed_formats: string[];
  max_size_mb: number;
  status: DocumentStatus;
  uploaded_file_id?: string;
  uploaded_file_name?: string;
  uploaded_at?: string;
  rejection_reason?: string;
}

export interface DocumentUploadPayload {
  child_id: string;
  requirement_id: string;
  file: File;
}

export interface DocumentListResponse {
  documents: DocumentRequirement[];
  total_required: number;
  total_uploaded: number;
  total_approved: number;
  total_rejected: number;
}

// ======================== ADMISSION TIMELINE ========================

export interface AdmissionTimelineEvent {
  id: string;
  child_id: string;
  event_type: string;
  title: string;
  description?: string;
  status: "COMPLETED" | "CURRENT" | "UPCOMING" | "SKIPPED";
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface AdmissionOverview {
  child: ChildProfile;
  timeline: AdmissionTimelineEvent[];
  registration?: RegistrationFormData;
  interview?: InterviewSchedule;
  assessment?: AssessmentSchedule;
  payment_summary?: PaymentSummary;
  documents?: DocumentListResponse;
}

// ======================== NOTIFICATIONS ========================

export interface ParentNotification {
  id: string;
  parent_id: string;
  child_id?: string;
  title: string;
  message: string;
  type: "INFO" | "ACTION_REQUIRED" | "SUCCESS" | "WARNING";
  is_read: boolean;
  action_url?: string;
  created_at: string;
}
