// ─── Search / Filter DTO ────────────────────────────────────────────────────
export interface FeeSearchFilterDTO {
    page: number; // 0-indexed
    size: number;
    sortBy: string; // studentName | cpoName | totalExpectedAmount | totalPaidAmount | dueAmount | overdueAmount | status
    sortDirection: 'ASC' | 'DESC';
    filters: {
        packageSessionIds?: string[];
        cpoIds?: string[];
        statuses?: string[]; // PAID | OVERDUE | PARTIAL | PENDING
        studentSearchQuery?: string;
    };
}

// ─── Main Table Row (Aggregated: Student + CPO) ─────────────────────────────
export interface StudentFeePaymentRowDTO {
    student_id: string;
    cpo_id: string;
    package_session_ids: string[];
    student_name: string;
    phone: string;
    cpo_name: string;
    total_expected_amount: number;
    total_paid_amount: number;
    due_amount: number;
    overdue_amount: number;
    status: 'PAID' | 'OVERDUE' | 'PARTIAL' | 'PENDING';
}

// ─── Paginated Response (Spring Boot Page) ──────────────────────────────────
export interface FinancalManagementPaginatedResponse {
    content: StudentFeePaymentRowDTO[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    last: boolean;
    // snake_case variants from backend
    total_elements?: number;
    total_pages?: number;
    page_no?: number;
    page_size?: number;
}

// ─── Installment Detail (Popup) ─────────────────────────────────────────────
export interface InstallmentDetailDTO {
    fee_type_name: string;
    installment_number: number;
    amount_expected: number;
    discount_amount: number;
    amount_paid: number;
    due_amount: number;
    due_date: string; // ISO datetime
    status: 'PAID' | 'OVERDUE' | 'PARTIAL' | 'PENDING';
}
