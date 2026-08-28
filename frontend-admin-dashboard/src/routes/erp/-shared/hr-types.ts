/**
 * Wire types for the HR & Payroll APIs.
 *
 * All payloads are snake_case (the backend DTOs use @JsonNaming SnakeCase), so
 * these interfaces are written snake_case too — no mapping layer, nothing to
 * drift. Money fields arrive as strings or numbers depending on the endpoint
 * (BigDecimal serialization), hence `number | string` on amounts; pass them
 * straight to MoneyCell which normalizes.
 */

export type Money = number | string | null;

// ───────────────────────── People ─────────────────────────

export interface EmployeeProfileDTO {
    id?: string;
    user_id?: string;
    institute_id?: string;
    employee_code?: string;
    department_id?: string;
    department_name?: string;
    designation_id?: string;
    designation_name?: string;
    reporting_manager_id?: string;
    reporting_manager_name?: string;
    employment_type?: string;
    employment_status?: string;
    join_date?: string;
    probation_end_date?: string;
    confirmation_date?: string;
    notice_period_days?: number;
    resignation_date?: string;
    last_working_date?: string;
    exit_reason?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relation?: string;
    nationality?: string;
    blood_group?: string;
    marital_status?: string;
    /** Masked on read (****1234); send a fresh value to change it. */
    pan_number?: string;
    tax_id_number?: string;
    uan_number?: string;
    /** HR-admin only in responses. */
    statutory_info?: Record<string, unknown>;
    custom_fields?: Record<string, unknown>;
    full_name?: string;
    email?: string;
    mobile_number?: string;
}

export interface DepartmentDTO {
    id?: string;
    institute_id?: string;
    name?: string;
    code?: string;
    parent_id?: string;
    head_user_id?: string;
    description?: string;
    status?: string;
}

export interface DesignationDTO {
    id?: string;
    institute_id?: string;
    name?: string;
    code?: string;
    level?: number;
    grade?: string;
    description?: string;
    status?: string;
}

export interface StaffBridgeRow {
    user_id?: string;
    full_name?: string;
    email?: string;
    mobile_number?: string;
    roles?: string[];
    status?: string;
    employee_id?: string;
    employee_code?: string;
    teaches?: boolean;
    /** Set when the user already has an HR profile in a DIFFERENT institute. */
    blocked_reason?: string;
}

export interface StaffBridgeResponse {
    rows?: StaffBridgeRow[];
    page?: number;
    size?: number;
    total_elements?: number;
    total_staff?: number;
    with_hr_profile?: number;
    teaching_without_profile?: number;
}

// ───────────────────────── Salary ─────────────────────────

export type ComponentType = 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';

export type CalculationType =
    | 'FIXED_AMOUNT'
    | 'PERCENTAGE_OF_BASIC'
    | 'PERCENTAGE_OF_CTC'
    | 'PERCENTAGE_OF_GROSS'
    | 'FORMULA';

export interface SalaryComponentDTO {
    id?: string;
    institute_id?: string;
    name?: string;
    code?: string;
    type?: ComponentType;
    category?: string;
    is_taxable?: boolean;
    is_statutory?: boolean;
    is_active?: boolean;
    display_order?: number;
    description?: string;
    /** GL account this component posts to in the ERP journal (V484). */
    gl_account_code?: string;
}

export interface SalaryTemplateComponentDTO {
    id?: string;
    component_id?: string;
    component_name?: string;
    component_code?: string;
    component_type?: ComponentType;
    calculation_type?: CalculationType;
    percentage_value?: Money;
    fixed_value?: Money;
    formula?: string;
    min_value?: Money;
    max_value?: Money;
    display_order?: number;
    is_mandatory?: boolean;
}

export interface SalaryTemplateDTO {
    id?: string;
    institute_id?: string;
    name?: string;
    description?: string;
    is_default?: boolean;
    status?: string;
    components?: SalaryTemplateComponentDTO[];
}

export interface EmployeeSalaryComponentDTO {
    id?: string;
    component_id?: string;
    component_name?: string;
    component_code?: string;
    component_type?: ComponentType;
    monthly_amount?: Money;
    annual_amount?: Money;
    calculation_type?: CalculationType;
    percentage_value?: Money;
    is_overridden?: boolean;
}

export interface EmployeeSalaryStructureDTO {
    id?: string;
    employee_id?: string;
    template_id?: string;
    template_name?: string;
    effective_from?: string;
    effective_to?: string;
    ctc_annual?: Money;
    ctc_monthly?: Money;
    gross_monthly?: Money;
    net_monthly?: Money;
    currency?: string;
    status?: string;
    revision_reason?: string;
    components?: EmployeeSalaryComponentDTO[];
}

export interface AssignSalaryPayload {
    employee_id: string;
    template_id?: string;
    ctc_annual: number;
    effective_from: string;
    currency?: string;
    revision_reason?: string;
}

// ───────────────────────── Payroll ─────────────────────────

export interface PayrollRunDTO {
    id?: string;
    institute_id?: string;
    month?: number;
    year?: number;
    run_date?: string;
    status?: string;
    run_type?: string;
    total_employees?: number;
    total_gross?: Money;
    total_deductions?: Money;
    total_net_pay?: Money;
    total_employer_cost?: Money;
    currency?: string;
    processed_by?: string;
    processed_at?: string;
    approved_by?: string;
    approved_at?: string;
    notes?: string;
}

export interface PayrollEntryComponentDTO {
    component_id?: string;
    component_name?: string;
    component_code?: string;
    component_type?: ComponentType;
    amount?: Money;
}

export interface PayrollEntryDTO {
    id?: string;
    payroll_run_id?: string;
    employee_id?: string;
    employee_code?: string;
    gross_salary?: Money;
    total_earnings?: Money;
    total_deductions?: Money;
    total_employer_contributions?: Money;
    net_pay?: Money;
    total_working_days?: number;
    days_present?: Money;
    days_absent?: Money;
    days_on_leave?: Money;
    days_holiday?: number;
    overtime_hours?: Money;
    arrears?: Money;
    reimbursements?: Money;
    loan_deduction?: Money;
    currency?: string;
    status?: string;
    hold_reason?: string;
    components?: PayrollEntryComponentDTO[];
}

/** Per-employee processing failure (hr_payroll_entry_error). Entity-shaped, not snake_case DTO. */
export interface PayrollEntryError {
    id?: string;
    payrollRunId?: string;
    employeeId?: string;
    errorStage?: string;
    errorMessage?: string;
    createdAt?: string;
}

export interface CreatePayrollRunPayload {
    month: number;
    year: number;
    run_type?: string;
    notes?: string;
}

export interface PayrollAdjustmentDTO {
    id?: string;
    employee_id?: string;
    month?: number;
    year?: number;
    type?: 'EARNING' | 'DEDUCTION';
    code?: string;
    label?: string;
    amount?: Money;
    currency?: string;
    run_scope?: string;
    source?: string;
    notes?: string;
    payroll_entry_id?: string;
}
