export interface OfflineQuestionResponse {
    question_id: string;
    type: string;
    option_ids: string[];
}

export interface OfflineSectionResponse {
    section_id: string;
    questions: OfflineQuestionResponse[];
}

export interface OfflineResponseSubmitRequest {
    sections: OfflineSectionResponse[];
}

export interface OfflineAttemptCreateResponse {
    attempt_id: string;
    registration_id: string;
    assessment_id: string;
}

export interface DirectMarksSubmitRequest {
    set_id?: string;
    file_id?: string;
    data_json?: string;
    request: DirectMarksQuestionDto[];
}

export interface DirectMarksQuestionDto {
    section_id: string;
    question_id: string;
    status: string;
    marks: number;
}

// The three scanned PDFs an admin can attach to an offline attempt. Every field
// is optional — the backend leaves an omitted slot untouched.
export interface OfflineAttachmentsRequest {
    student_file_id?: string;
    checked_file_id?: string;
    report_file_id?: string;
}

// ---- Bulk import (zip of scans + CSV manifest) ----

export interface OfflineBulkImportEntry {
    // Echoed back on the result so a failure points at the CSV line.
    row_label: string;
    registration_id?: string;
    user_id?: string;
    full_name?: string;
    email?: string;
    username?: string;
    mobile_number?: string;
    batch_id?: string;
    // Omitted leaves the attempt's marks alone (attachments-only row).
    total_marks?: number;
    student_file_id?: string;
    checked_file_id?: string;
    report_file_id?: string;
}

export interface OfflineBulkImportRequest {
    entries: OfflineBulkImportEntry[];
}

export interface OfflineBulkImportResult {
    row_label: string;
    username: string;
    status: 'SUCCESS' | 'FAILED';
    attempt_id?: string;
    message?: string;
}

export interface OfflineBulkImportResponse {
    results: OfflineBulkImportResult[];
    success_count: number;
    failure_count: number;
}

// Which of the three attachment slots a file belongs to.
export type AttachmentSlot = 'student' | 'checked' | 'report';

// Files picked in the UI but not yet uploaded to S3.
export type OfflineAttachmentFiles = Partial<Record<AttachmentSlot, File>>;

// Per-question response state tracked by the UI
export interface QuestionResponseState {
    selectedOptionIds: string[];
    marks?: number;
    status?: string;
}

// Map of questionId -> response state
export type OfflineResponseState = Record<string, QuestionResponseState>;

export type ScoringMode = 'AUTO_CALCULATE' | 'DIRECT_MARKS';
