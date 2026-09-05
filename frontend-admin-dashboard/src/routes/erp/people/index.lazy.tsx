import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { IdentificationCard, Plus, UsersThree } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { MyButton } from '@/components/design-system/button';
import { MyPagination } from '@/components/design-system/pagination';
import { MyTable } from '@/components/design-system/table';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useHrRole } from '@/hooks/use-hr-role';
import { formatDate } from '@/lib/formatters';
import type { EmployeeProfileDTO } from '@/routes/erp/-shared/hr-types';
import { useDepartments, useDesignations, useEmployees } from './-hooks/use-hr-people';
import {
    EMPLOYMENT_STATUS_OPTIONS,
    EMPLOYMENT_TYPE_OPTIONS,
    EmploymentStatusChip,
    humanizeToken,
} from './-components/EmployeeFields';
import { EmployeeFormDialog } from './-components/EmployeeFormDialog';
import { HrEmptyState, HrErrorState, HrLoadingRows, HrNoAccessCard } from './-components/HrStates';
import { SingleFilterChip } from './-components/SingleFilterChip';

export const Route = createLazyFileRoute('/erp/people/')({
    component: EmployeesRoute,
});

const PAGE_SIZE = 10;

function EmployeesRoute() {
    return (
        <LayoutContainer>
            <EmployeesPage />
        </LayoutContainer>
    );
}

function EmployeesPage() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">People</h1>);
    }, [setNavHeading]);

    const navigate = useNavigate();
    const { isHrAdmin, isHrStaff } = useHrRole();

    const [page, setPage] = useState(0);
    const [status, setStatus] = useState<string | undefined>();
    const [departmentId, setDepartmentId] = useState<string | undefined>();
    const [designationId, setDesignationId] = useState<string | undefined>();
    const [employmentType, setEmploymentType] = useState<string | undefined>();
    const [addOpen, setAddOpen] = useState(false);

    const filters = useMemo(
        () => ({ page, size: PAGE_SIZE, status, departmentId, designationId, employmentType }),
        [page, status, departmentId, designationId, employmentType]
    );

    const employees = useEmployees(filters);
    const departments = useDepartments();
    const designations = useDesignations();

    const anyFilter = !!(status || departmentId || designationId || employmentType);
    /** Narrowing the list always returns to page 1 — page 4 of a two-row result is empty. */
    const applyFilter = (setter: (next: string | undefined) => void) => (next?: string) => {
        setter(next);
        setPage(0);
    };
    const clearFilters = () => {
        setStatus(undefined);
        setDepartmentId(undefined);
        setDesignationId(undefined);
        setEmploymentType(undefined);
        setPage(0);
    };

    const openEmployee = (employee: EmployeeProfileDTO) => {
        if (!employee.id) return;
        navigate({ to: '/erp/people/$employeeId', params: { employeeId: employee.id } });
    };

    const columns = useMemo<ColumnDef<EmployeeProfileDTO>[]>(
        () => [
            {
                id: 'employee_code',
                header: 'Code',
                size: 120,
                cell: ({ row }) => (
                    <span className="text-body text-muted-foreground">
                        {row.original.employee_code || '—'}
                    </span>
                ),
            },
            {
                id: 'full_name',
                header: 'Name',
                size: 200,
                cell: ({ row }) => (
                    <span className="truncate text-body font-semibold text-foreground">
                        {row.original.full_name || row.original.employee_code || 'Employee'}
                    </span>
                ),
            },
            {
                id: 'department',
                header: 'Department',
                size: 160,
                cell: ({ row }) => (
                    <span className="truncate text-body text-foreground">
                        {row.original.department_name || '—'}
                    </span>
                ),
            },
            {
                id: 'designation',
                header: 'Designation',
                size: 160,
                cell: ({ row }) => (
                    <span className="truncate text-body text-foreground">
                        {row.original.designation_name || '—'}
                    </span>
                ),
            },
            {
                id: 'employment_status',
                header: 'Status',
                size: 140,
                cell: ({ row }) => <EmploymentStatusChip status={row.original.employment_status} />,
            },
            {
                id: 'employment_type',
                header: 'Type',
                size: 120,
                cell: ({ row }) => (
                    <span className="text-body text-foreground">
                        {humanizeToken(row.original.employment_type) || '—'}
                    </span>
                ),
            },
            {
                id: 'join_date',
                header: 'Joined',
                size: 120,
                cell: ({ row }) => (
                    <span className="text-body text-muted-foreground">
                        {row.original.join_date ? formatDate(row.original.join_date) : '—'}
                    </span>
                ),
            },
        ],
        []
    );

    if (!isHrStaff) {
        return (
            <div className="p-4 sm:p-6">
                <HrNoAccessCard />
            </div>
        );
    }

    const rows = employees.data?.content ?? [];
    const totalPages = employees.data?.total_pages ?? 1;
    const totalElements = employees.data?.total_elements ?? rows.length;

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2 className="text-h2-semibold text-foreground">Employees</h2>
                    <p className="text-body text-muted-foreground">
                        HR profiles for everyone on your payroll — departments, designations and
                        employment status.
                    </p>
                </div>
                {isHrAdmin && (
                    <div className="flex flex-wrap items-center gap-3">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => navigate({ to: '/erp/people/staff-bridge' })}
                        >
                            <UsersThree size={18} /> Add from staff
                        </MyButton>
                        <MyButton
                            type="button"
                            buttonType="primary"
                            scale="medium"
                            onClick={() => setAddOpen(true)}
                        >
                            <Plus size={18} /> Add employee
                        </MyButton>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                    <SingleFilterChip
                        label="Status"
                        options={EMPLOYMENT_STATUS_OPTIONS.map((option) => ({
                            id: option.value,
                            label: option.label,
                        }))}
                        value={status}
                        onChange={applyFilter(setStatus)}
                    />
                    <SingleFilterChip
                        label="Department"
                        options={(departments.data ?? [])
                            .filter((row) => !!row.id)
                            .map((row) => ({
                                id: row.id as string,
                                label: row.name || (row.id as string),
                            }))}
                        value={departmentId}
                        onChange={applyFilter(setDepartmentId)}
                        disabled={(departments.data ?? []).length === 0}
                    />
                    <SingleFilterChip
                        label="Designation"
                        options={(designations.data ?? [])
                            .filter((row) => !!row.id)
                            .map((row) => ({
                                id: row.id as string,
                                label: row.name || (row.id as string),
                            }))}
                        value={designationId}
                        onChange={applyFilter(setDesignationId)}
                        disabled={(designations.data ?? []).length === 0}
                    />
                    <SingleFilterChip
                        label="Employment type"
                        options={EMPLOYMENT_TYPE_OPTIONS.map((option) => ({
                            id: option.value,
                            label: option.label,
                        }))}
                        value={employmentType}
                        onChange={applyFilter(setEmploymentType)}
                    />
                </div>
                {anyFilter && (
                    <span className="text-caption text-muted-foreground">
                        {totalElements} {totalElements === 1 ? 'employee' : 'employees'} match
                        {' · '}
                        <button
                            type="button"
                            className="font-semibold text-primary-500 hover:text-primary-600"
                            onClick={clearFilters}
                        >
                            Clear filters
                        </button>
                    </span>
                )}
            </div>

            {employees.isLoading ? (
                <HrLoadingRows />
            ) : employees.isError ? (
                <HrErrorState
                    message="Couldn't load employees."
                    onRetry={() => employees.refetch()}
                />
            ) : rows.length === 0 ? (
                anyFilter ? (
                    <HrEmptyState
                        title="No employees match these filters"
                        description="Try clearing one of them."
                    >
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="medium"
                            onClick={clearFilters}
                        >
                            Clear filters
                        </MyButton>
                    </HrEmptyState>
                ) : (
                    <HrEmptyState
                        icon={<IdentificationCard size={40} className="text-muted-foreground" />}
                        title="No employee profiles yet"
                        description="There are two ways to add people: create an HR profile for someone already on your team from Staff Coverage (fastest — it reuses their account), or add an employee manually if you have their platform user id."
                    >
                        {isHrAdmin && (
                            <>
                                <MyButton
                                    type="button"
                                    buttonType="primary"
                                    scale="medium"
                                    onClick={() => navigate({ to: '/erp/people/staff-bridge' })}
                                >
                                    <UsersThree size={18} /> Open Staff Coverage
                                </MyButton>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="medium"
                                    onClick={() => setAddOpen(true)}
                                >
                                    <Plus size={18} /> Add employee manually
                                </MyButton>
                            </>
                        )}
                    </HrEmptyState>
                )
            ) : (
                <div className="flex flex-col gap-3">
                    <MyTable<EmployeeProfileDTO>
                        data={{
                            content: rows,
                            total_pages: totalPages,
                            page_no: page,
                            page_size: PAGE_SIZE,
                            total_elements: totalElements,
                            last: employees.data?.last ?? true,
                        }}
                        columns={columns}
                        isLoading={false}
                        error={null}
                        currentPage={page}
                        onCellClick={(row) => openEmployee(row)}
                        scrollable
                    />
                    <MyPagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        totalElements={totalElements}
                        pageSize={PAGE_SIZE}
                    />
                </div>
            )}

            {isHrAdmin && (
                <EmployeeFormDialog
                    open={addOpen}
                    onOpenChange={setAddOpen}
                    departments={departments.data ?? []}
                    designations={designations.data ?? []}
                />
            )}
        </div>
    );
}
