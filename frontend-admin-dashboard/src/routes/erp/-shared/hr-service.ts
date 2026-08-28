import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import {
    HR_DEPARTMENTS,
    HR_DEPARTMENT_BY_ID,
    HR_DESIGNATIONS,
    HR_DESIGNATION_BY_ID,
    HR_EMPLOYEES,
    HR_EMPLOYEE_BY_ID,
    HR_EMPLOYEE_FROM_STAFF,
    HR_EMPLOYEE_STATUS,
    HR_PAYROLL_ADJUSTMENTS,
    HR_PAYROLL_ADJUSTMENT_BY_ID,
    HR_PAYROLL_ENTRY_HOLD,
    HR_PAYROLL_ENTRY_RELEASE,
    HR_PAYROLL_RUNS,
    HR_PAYROLL_RUN_APPROVE,
    HR_PAYROLL_RUN_BY_ID,
    HR_PAYROLL_RUN_ENTRIES,
    HR_PAYROLL_RUN_ERRORS,
    HR_PAYROLL_RUN_MARK_PAID,
    HR_PAYROLL_RUN_PROCESS,
    HR_PAYROLL_RUN_REJECT,
    HR_SALARY_COMPONENTS,
    HR_SALARY_COMPONENT_BY_ID,
    HR_SALARY_STRUCTURES,
    HR_SALARY_TEMPLATES,
    HR_SALARY_TEMPLATE_BY_ID,
    HR_STAFF_BRIDGE,
} from '@/constants/urls';
import type {
    AssignSalaryPayload,
    CreatePayrollRunPayload,
    DepartmentDTO,
    DesignationDTO,
    EmployeeProfileDTO,
    EmployeeSalaryStructureDTO,
    PayrollAdjustmentDTO,
    PayrollEntryDTO,
    PayrollEntryError,
    PayrollRunDTO,
    SalaryComponentDTO,
    SalaryTemplateDTO,
    StaffBridgeResponse,
} from '@/routes/erp/-shared/hr-types';

/**
 * HR & Payroll data layer.
 *
 * One module for the whole ERP surface so the query-key namespace stays in a
 * single place — payroll mutations invalidate across module boundaries all the
 * time (approving a run changes the journal; materializing an adjustment changes
 * the next run), and scattering keys per route makes those invalidations
 * guesswork.
 *
 * Every call passes the institute as a query param (`instituteId`), never in the
 * body: the backend deliberately ignores body-supplied institute ids after a
 * cross-tenant spoofing fix, so a body field would be silently dropped.
 */

const instituteParams = (extra?: Record<string, unknown>) => ({
    params: { instituteId: getInstituteId(), ...(extra ?? {}) },
});

/** Root of every ERP query key — `queryClient.invalidateQueries({ queryKey: ERP_KEY })` clears all. */
export const ERP_KEY = ['erp'] as const;

export const hrKeys = {
    employees: (filters?: Record<string, unknown>) => [...ERP_KEY, 'employees', filters ?? {}],
    employee: (id: string) => [...ERP_KEY, 'employee', id],
    departments: () => [...ERP_KEY, 'departments'],
    designations: () => [...ERP_KEY, 'designations'],
    staffBridge: (filters?: Record<string, unknown>) => [...ERP_KEY, 'staff-bridge', filters ?? {}],
    salaryComponents: () => [...ERP_KEY, 'salary-components'],
    salaryTemplates: () => [...ERP_KEY, 'salary-templates'],
    salaryTemplate: (id: string) => [...ERP_KEY, 'salary-template', id],
    salaryStructures: (employeeId: string) => [...ERP_KEY, 'salary-structures', employeeId],
    payrollRuns: (year?: number) => [...ERP_KEY, 'payroll-runs', year ?? 'all'],
    payrollRun: (id: string) => [...ERP_KEY, 'payroll-run', id],
    payrollEntries: (runId: string) => [...ERP_KEY, 'payroll-entries', runId],
    payrollErrors: (runId: string) => [...ERP_KEY, 'payroll-errors', runId],
    adjustments: (year: number, month: number) => [...ERP_KEY, 'adjustments', year, month],
};

// ───────────────────────── People ─────────────────────────

export interface EmployeeListFilters {
    page?: number;
    size?: number;
    status?: string;
    departmentId?: string;
    designationId?: string;
    employmentType?: string;
}

/**
 * Employees, paginated. The endpoint returns a Spring `Page`, whose field names
 * already match MyTable's TableData shape except for `content`/`totalPages` —
 * normalized here so every caller can hand the result straight to MyTable.
 */
export const fetchEmployees = async (filters: EmployeeListFilters = {}) => {
    const { data } = await authenticatedAxiosInstance.get(
        HR_EMPLOYEES,
        instituteParams({
            page: filters.page ?? 0,
            size: filters.size ?? 10,
            status: filters.status,
            departmentId: filters.departmentId,
            designationId: filters.designationId,
            employmentType: filters.employmentType,
        })
    );
    return {
        content: (data?.content ?? []) as EmployeeProfileDTO[],
        total_pages: data?.totalPages ?? data?.total_pages ?? 1,
        page_no: data?.number ?? data?.page_no ?? 0,
        page_size: data?.size ?? data?.page_size ?? 10,
        total_elements: data?.totalElements ?? data?.total_elements ?? 0,
        last: data?.last ?? true,
    };
};

export const fetchEmployee = async (id: string): Promise<EmployeeProfileDTO> => {
    const { data } = await authenticatedAxiosInstance.get(HR_EMPLOYEE_BY_ID(id), instituteParams());
    return data;
};

export const createEmployee = async (payload: EmployeeProfileDTO): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.post(HR_EMPLOYEES, payload, instituteParams());
    return data;
};

export const updateEmployee = async (id: string, payload: EmployeeProfileDTO): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.put(
        HR_EMPLOYEE_BY_ID(id),
        payload,
        instituteParams()
    );
    return data;
};

export const updateEmployeeStatus = async (
    id: string,
    payload: { employment_status: string; last_working_date?: string; exit_reason?: string }
): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.put(
        HR_EMPLOYEE_STATUS(id),
        payload,
        instituteParams()
    );
    return data;
};

export const fetchDepartments = async (): Promise<DepartmentDTO[]> => {
    const { data } = await authenticatedAxiosInstance.get(HR_DEPARTMENTS, instituteParams());
    return data ?? [];
};

export const saveDepartment = async (payload: DepartmentDTO): Promise<string> => {
    const { data } = payload.id
        ? await authenticatedAxiosInstance.put(
              HR_DEPARTMENT_BY_ID(payload.id),
              payload,
              instituteParams()
          )
        : await authenticatedAxiosInstance.post(HR_DEPARTMENTS, payload, instituteParams());
    return data;
};

export const deactivateDepartment = async (id: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(HR_DEPARTMENT_BY_ID(id), instituteParams());
};

export const fetchDesignations = async (): Promise<DesignationDTO[]> => {
    const { data } = await authenticatedAxiosInstance.get(HR_DESIGNATIONS, instituteParams());
    return data ?? [];
};

export const saveDesignation = async (payload: DesignationDTO): Promise<string> => {
    const { data } = payload.id
        ? await authenticatedAxiosInstance.put(
              HR_DESIGNATION_BY_ID(payload.id),
              payload,
              instituteParams()
          )
        : await authenticatedAxiosInstance.post(HR_DESIGNATIONS, payload, instituteParams());
    return data;
};

export interface StaffBridgeFilters {
    role?: string;
    search?: string;
    page?: number;
    size?: number;
}

export const fetchStaffBridge = async (
    filters: StaffBridgeFilters = {}
): Promise<StaffBridgeResponse> => {
    const { data } = await authenticatedAxiosInstance.get(
        HR_STAFF_BRIDGE,
        instituteParams({
            role: filters.role,
            search: filters.search,
            page: filters.page ?? 0,
            size: filters.size ?? 25,
        })
    );
    return data ?? {};
};

export const createEmployeeFromStaff = async (payload: {
    user_id: string;
    employee_code?: string;
    join_date?: string;
    department_id?: string;
    designation_id?: string;
}): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.post(
        HR_EMPLOYEE_FROM_STAFF,
        payload,
        instituteParams()
    );
    return data;
};

// ───────────────────────── Salary ─────────────────────────

export const fetchSalaryComponents = async (): Promise<SalaryComponentDTO[]> => {
    const { data } = await authenticatedAxiosInstance.get(HR_SALARY_COMPONENTS, instituteParams());
    return data ?? [];
};

export const saveSalaryComponent = async (payload: SalaryComponentDTO): Promise<string> => {
    const { data } = payload.id
        ? await authenticatedAxiosInstance.put(
              HR_SALARY_COMPONENT_BY_ID(payload.id),
              payload,
              instituteParams()
          )
        : await authenticatedAxiosInstance.post(HR_SALARY_COMPONENTS, payload, instituteParams());
    return data;
};

export const fetchSalaryTemplates = async (): Promise<SalaryTemplateDTO[]> => {
    const { data } = await authenticatedAxiosInstance.get(HR_SALARY_TEMPLATES, instituteParams());
    return data ?? [];
};

export const fetchSalaryTemplate = async (id: string): Promise<SalaryTemplateDTO> => {
    const { data } = await authenticatedAxiosInstance.get(
        HR_SALARY_TEMPLATE_BY_ID(id),
        instituteParams()
    );
    return data;
};

export const saveSalaryTemplate = async (payload: SalaryTemplateDTO): Promise<string> => {
    const { data } = payload.id
        ? await authenticatedAxiosInstance.put(
              HR_SALARY_TEMPLATE_BY_ID(payload.id),
              payload,
              instituteParams()
          )
        : await authenticatedAxiosInstance.post(HR_SALARY_TEMPLATES, payload, instituteParams());
    return data;
};

export const fetchSalaryStructures = async (
    employeeId: string
): Promise<EmployeeSalaryStructureDTO[]> => {
    const { data } = await authenticatedAxiosInstance.get(
        HR_SALARY_STRUCTURES,
        instituteParams({ employeeId })
    );
    return data ?? [];
};

export const assignSalaryStructure = async (payload: AssignSalaryPayload): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.post(
        HR_SALARY_STRUCTURES,
        payload,
        instituteParams()
    );
    return data;
};

// ───────────────────────── Payroll ─────────────────────────

export const fetchPayrollRuns = async (year?: number): Promise<PayrollRunDTO[]> => {
    const { data } = await authenticatedAxiosInstance.get(
        HR_PAYROLL_RUNS,
        instituteParams(year ? { year } : undefined)
    );
    return data ?? [];
};

export const fetchPayrollRun = async (id: string): Promise<PayrollRunDTO> => {
    const { data } = await authenticatedAxiosInstance.get(
        HR_PAYROLL_RUN_BY_ID(id),
        instituteParams()
    );
    return data;
};

export const createPayrollRun = async (payload: CreatePayrollRunPayload): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.post(
        HR_PAYROLL_RUNS,
        payload,
        instituteParams()
    );
    return data;
};

/**
 * Process a run. Synchronous server-side and O(employees) — the caller should
 * expect this to take a while on a large institute and must not race it. The
 * response string may carry a partial-failure note ("… N failed — see run
 * errors"), so surface it rather than assuming success means "all paid".
 */
export const processPayrollRun = async (id: string): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.post(
        HR_PAYROLL_RUN_PROCESS(id),
        {},
        instituteParams()
    );
    return data;
};

export const approvePayrollRun = async (id: string): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.put(
        HR_PAYROLL_RUN_APPROVE(id),
        {},
        instituteParams()
    );
    return data;
};

/** PROCESSED/APPROVED → DRAFT, reversing loans, reimbursements, tax rows and the journal. */
export const rejectPayrollRun = async (id: string): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.put(
        HR_PAYROLL_RUN_REJECT(id),
        {},
        instituteParams()
    );
    return data;
};

export const markPayrollRunPaid = async (id: string): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.put(
        HR_PAYROLL_RUN_MARK_PAID(id),
        {},
        instituteParams()
    );
    return data;
};

export const cancelPayrollRun = async (id: string): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.delete(
        HR_PAYROLL_RUN_BY_ID(id),
        instituteParams()
    );
    return data;
};

export const fetchPayrollEntries = async (runId: string): Promise<PayrollEntryDTO[]> => {
    const { data } = await authenticatedAxiosInstance.get(
        HR_PAYROLL_RUN_ENTRIES(runId),
        instituteParams()
    );
    return data ?? [];
};

export const fetchPayrollErrors = async (runId: string): Promise<PayrollEntryError[]> => {
    const { data } = await authenticatedAxiosInstance.get(
        HR_PAYROLL_RUN_ERRORS(runId),
        instituteParams()
    );
    return data ?? [];
};

export const holdPayrollEntry = async (id: string, holdReason: string): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.put(
        HR_PAYROLL_ENTRY_HOLD(id),
        { hold_reason: holdReason },
        instituteParams()
    );
    return data;
};

export const releasePayrollEntry = async (id: string): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.put(
        HR_PAYROLL_ENTRY_RELEASE(id),
        {},
        instituteParams()
    );
    return data;
};

// ─────────────────── Variable pay (adjustments) ───────────────────

export const fetchAdjustments = async (
    year: number,
    month: number
): Promise<PayrollAdjustmentDTO[]> => {
    const { data } = await authenticatedAxiosInstance.get(
        HR_PAYROLL_ADJUSTMENTS,
        instituteParams({ year, month })
    );
    return data ?? [];
};

export const createAdjustment = async (payload: PayrollAdjustmentDTO): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.post(
        HR_PAYROLL_ADJUSTMENTS,
        payload,
        instituteParams()
    );
    return data;
};

export const deleteAdjustment = async (id: string): Promise<string> => {
    const { data } = await authenticatedAxiosInstance.delete(
        HR_PAYROLL_ADJUSTMENT_BY_ID(id),
        instituteParams()
    );
    return data;
};
