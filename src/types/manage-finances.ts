export interface FeeSearchFilterDTO {
    page: number; // 0-indexed
    size: number;
    sortBy: string; // e.g., 'dueDate'
    sortDirection: 'ASC' | 'DESC';
    filters: {
        packageSessionIds?: string[]; // Dropdown to filter by courses
        cpoIds?: string[]; // Dropdown to filter by Fee Structure Templates
        feeTypeIds?: string[]; // Dropdown to filter by component (Tuition, Library, etc)
        statuses?: string[]; // Checkboxes for PENDING, PAID, PARTIAL_PAID, OVERDUE
        dueDateRange?: {
            startDate: string; // YYYY-MM-DD
            endDate: string; // YYYY-MM-DD
        };
        studentSearchQuery?: string; // Search bar for Student Name or Email
    };
}

export interface StudentFeePaymentRowDTO {
    paymentId: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    packageSessionIds: string[]; // Array of linked package session IDs (may be empty for no enrollment)
    feeTypeName: string; // e.g., "Tuition Fee"
    installmentNumber: number;
    amountExpected: number;
    discountAmount: number;
    amountPaid: number;
    totalDue: number; // (amountExpected - discountAmount) - amountPaid
    dueDate: string; // YYYY-MM-DD
    status: 'PENDING' | 'PAID' | 'PARTIAL_PAID' | 'OVERDUE' | 'WAIVED';
}

export interface FinancalManagementPaginatedResponse {
    totalElements: number;
    totalPages: number;
    content: StudentFeePaymentRowDTO[];
    number: number;
    size: number;
    last: boolean;
}
