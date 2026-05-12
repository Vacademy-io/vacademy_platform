// Mirrors the backend DTOs in admin_core_service for the CPO side-view
// endpoints under /admin-core-service/v1/fee-management. Snake-case wire
// format on both sides — Spring serializes via SnakeCaseStrategy and we
// keep the same shape here without any axios interceptor remapping.

export type DiscountType = 'PERCENTAGE' | 'FLAT';

export interface DiscountSpec {
    type: DiscountType;
    value: number;
    reason?: string | null;
}

// ---------- Read shapes (backend → frontend) ----------

export interface CpoUserPlanSummary {
    user_plan_id: string;
    cpo_id: string | null;
    cpo_name: string | null;
    payment_option_id: string | null;
    payment_option_name: string | null;
    status: string | null;
    gross_total: number;
    net_total: number;
    paid_total: number;
    outstanding_total: number;
    installment_count: number;
    start_date?: string | null;
    end_date?: string | null;
}

export interface DiscountEntry {
    type: DiscountType;
    value: number;
    resolved_amount?: number | null;
    reason?: string | null;
    applied_by?: string | null;
    applied_at?: string | null;
}

export interface InstallmentDiscountEntry {
    aft_installment_id?: string | null;
    type: DiscountType;
    value: number;
    resolved_amount?: number | null;
    reason?: string | null;
    applied_by?: string | null;
    applied_at?: string | null;
}

export interface ManualAmountOverrideEntry {
    previous_amount?: number | null;
    new_amount: number;
    reason?: string | null;
    applied_by?: string | null;
    applied_at?: string | null;
}

export interface HistoryEntry {
    action: string;
    scope: 'CPO' | 'INSTALLMENT';
    target_id?: string | null;
    before?: unknown;
    after?: unknown;
    by?: string | null;
    at?: string | null;
}

export interface CpoInstallmentRow {
    id: string;
    aft_installment_id?: string | null;
    original_amount: number;
    amount_expected: number;
    amount_paid: number;
    outstanding: number;
    start_date?: string | null;
    due_date?: string | null;
    status: string;
    installment_discount?: InstallmentDiscountEntry | null;
    manual_amount_override?: ManualAmountOverrideEntry | null;
}

export interface CpoSideViewInstallmentsResponse {
    user_plan_id: string;
    user_id: string;
    cpo_id: string | null;
    gross_total: number;
    net_total: number;
    paid_total: number;
    outstanding_total: number;
    cpo_discount?: DiscountEntry | null;
    installments: CpoInstallmentRow[];
    history?: HistoryEntry[] | null;
}

// ---------- Write shapes (frontend → backend) ----------

export interface ModifyInstallmentRequest {
    start_date?: string | null;
    due_date?: string | null;
    amount?: number | null;
    clear_amount_override?: boolean;
    discount?: DiscountSpec | null;
    clear_discount?: boolean;
}

export interface ApplyCpoDiscountRequest {
    discount?: DiscountSpec | null;
    remove?: boolean;
}

export interface RecordOfflinePaymentRequest {
    amount: number;
    payment_date?: string | null;
    reference?: string | null;
    currency?: string | null;
    generate_invoice?: boolean;
}
