import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, Chalkboard, MagnifyingGlass, Plus, UsersThree } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MyPagination } from '@/components/design-system/pagination';
import { MyTable } from '@/components/design-system/table';
import { InputChips } from '@/components/design-system/chips';
import { Card, CardContent } from '@/components/ui/card';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useHrRole } from '@/hooks/use-hr-role';
import type { StaffBridgeRow } from '@/routes/erp/-shared/hr-types';
import { useDebouncedValue } from '../-hooks/use-debounced-value';
import { useDepartments, useDesignations, useStaffBridge } from '../-hooks/use-hr-people';
import { humanizeToken } from '../-components/EmployeeFields';
import { HrEmptyState, HrErrorState, HrLoadingRows, HrNoAccessCard } from '../-components/HrStates';
import { SingleFilterChip } from '../-components/SingleFilterChip';
import { StaffProfileDialog } from '../-components/StaffProfileDialog';

export const Route = createLazyFileRoute('/erp/people/staff-bridge/')({
    component: StaffBridgeRoute,
});

const PAGE_SIZE = 25;

/** The roles the bridge endpoint filters by — the institute's non-learner roles. */
const ROLE_OPTIONS = [
    { id: 'ADMIN', label: 'Admin' },
    { id: 'TEACHER', label: 'Teacher' },
    { id: 'EVALUATOR', label: 'Evaluator' },
    { id: 'CONTENT CREATOR', label: 'Content creator' },
    { id: 'ASSESSMENT CREATOR', label: 'Assessment creator' },
];

function StaffBridgeRoute() {
    return (
        <LayoutContainer>
            <StaffBridgePage />
        </LayoutContainer>
    );
}

function StatCard({
    label,
    value,
    hint,
    icon,
}: {
    label: string;
    value: number;
    hint?: string;
    icon: React.ReactNode;
}) {
    return (
        <Card>
            <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-md bg-muted p-2">{icon}</div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-muted-foreground">{label}</span>
                    <span className="text-h2-semibold tabular-nums text-foreground">{value}</span>
                    {hint && <span className="text-caption text-muted-foreground">{hint}</span>}
                </div>
            </CardContent>
        </Card>
    );
}

function StaffBridgePage() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">People</h1>);
    }, [setNavHeading]);

    const navigate = useNavigate();
    const { isHrAdmin, isHrStaff } = useHrRole();

    const [page, setPage] = useState(0);
    const [role, setRole] = useState<string | undefined>();
    const [searchInput, setSearchInput] = useState('');
    const search = useDebouncedValue(searchInput);
    const [createFor, setCreateFor] = useState<StaffBridgeRow | null>(null);

    // The debounce lands a beat after typing; without this a search typed on page 3
    // would ask the server for page 3 of a much shorter result.
    useEffect(() => {
        setPage(0);
    }, [search, role]);

    const bridge = useStaffBridge({
        page,
        size: PAGE_SIZE,
        role,
        search: search.trim() || undefined,
    });
    const departments = useDepartments();
    const designations = useDesignations();

    const rows = bridge.data?.rows ?? [];
    const totalElements = bridge.data?.total_elements ?? rows.length;
    const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
    const anyFilter = !!role || !!search.trim();

    const columns = useMemo<ColumnDef<StaffBridgeRow>[]>(
        () => [
            {
                id: 'full_name',
                header: 'Name',
                size: 190,
                cell: ({ row }) => (
                    <span className="truncate text-body font-semibold text-foreground">
                        {row.original.full_name || row.original.email || 'Team member'}
                    </span>
                ),
            },
            {
                id: 'email',
                header: 'Email',
                size: 210,
                cell: ({ row }) => (
                    <span className="truncate text-body text-muted-foreground">
                        {row.original.email || '—'}
                    </span>
                ),
            },
            {
                id: 'roles',
                header: 'Roles',
                size: 200,
                cell: ({ row }) => {
                    const roles = row.original.roles ?? [];
                    if (roles.length === 0) {
                        return <span className="text-caption text-muted-foreground">—</span>;
                    }
                    return (
                        <div className="flex flex-wrap items-center gap-1">
                            {roles.map((name) => (
                                <InputChips key={name} label={humanizeToken(name)} />
                            ))}
                        </div>
                    );
                },
            },
            {
                id: 'teaches',
                header: 'Teaches',
                size: 100,
                cell: ({ row }) =>
                    row.original.teaches ? (
                        <span className="flex items-center gap-1 text-caption text-success-600">
                            <Chalkboard size={16} /> Yes
                        </span>
                    ) : (
                        <span className="text-caption text-muted-foreground">No</span>
                    ),
            },
            {
                id: 'hr_profile',
                header: 'HR profile',
                size: 200,
                cell: ({ row }) => {
                    const staff = row.original;

                    if (staff.employee_id || staff.employee_code) {
                        return (
                            <button
                                type="button"
                                className="flex items-center gap-1 text-body text-primary-600 hover:underline"
                                onClick={() =>
                                    staff.employee_id &&
                                    navigate({
                                        to: '/erp/people/$employeeId',
                                        params: { employeeId: staff.employee_id },
                                    })
                                }
                            >
                                <CheckCircle size={16} weight="fill" className="text-success-600" />
                                {staff.employee_code || 'View profile'}
                            </button>
                        );
                    }

                    // A profile already exists in another institute. Not an error and not
                    // something an admin here can fix — say so and stop offering the button.
                    if (staff.blocked_reason) {
                        return (
                            <span className="text-caption text-muted-foreground">
                                {staff.blocked_reason}
                            </span>
                        );
                    }

                    if (!isHrAdmin) {
                        return <span className="text-caption text-muted-foreground">None yet</span>;
                    }

                    return (
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            onClick={() => setCreateFor(staff)}
                        >
                            <Plus size={14} /> Create HR profile
                        </MyButton>
                    );
                },
            },
        ],
        // `navigate` and the setter are stable; only the role gate changes a cell.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isHrAdmin]
    );

    if (!isHrStaff) {
        return (
            <div className="p-4 sm:p-6">
                <HrNoAccessCard />
            </div>
        );
    }

    const totalStaff = bridge.data?.total_staff ?? 0;
    const withProfile = bridge.data?.with_hr_profile ?? 0;
    const teachingWithout = bridge.data?.teaching_without_profile ?? 0;

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2 className="text-h2-semibold text-foreground">Staff coverage</h2>
                    <p className="text-body text-muted-foreground">
                        Everyone on your team, and whether they have an HR profile. Creating one
                        here reuses their existing account — no new user, no invitation.
                    </p>
                </div>
                <MyButton
                    type="button"
                    buttonType="secondary"
                    scale="medium"
                    onClick={() => navigate({ to: '/erp/people' })}
                >
                    <UsersThree size={18} /> All employees
                </MyButton>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    label="Team members"
                    value={totalStaff}
                    icon={<UsersThree size={20} className="text-primary-500" />}
                />
                <StatCard
                    label="With an HR profile"
                    value={withProfile}
                    hint={
                        totalStaff > 0
                            ? `${Math.round((withProfile / totalStaff) * 100)}% covered`
                            : undefined
                    }
                    icon={<CheckCircle size={20} className="text-success-600" />}
                />
                <StatCard
                    label="Teaching, no profile"
                    value={teachingWithout}
                    hint={
                        teachingWithout > 0
                            ? 'These people are paid but invisible to payroll'
                            : 'Every teacher is covered'
                    }
                    icon={<Chalkboard size={20} className="text-warning-600" />}
                />
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-80">
                    <MagnifyingGlass
                        size={16}
                        className="pointer-events-none absolute start-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
                    />
                    <MyInput
                        input={searchInput}
                        onChangeFunction={(event: React.ChangeEvent<HTMLInputElement>) =>
                            setSearchInput(event.target.value)
                        }
                        inputType="text"
                        inputPlaceholder="Search by name or email"
                        className="ps-9 sm:w-full"
                    />
                </div>
                <SingleFilterChip
                    label="Role"
                    options={ROLE_OPTIONS}
                    value={role}
                    onChange={setRole}
                />
                {anyFilter && (
                    <button
                        type="button"
                        className="text-caption font-semibold text-primary-500 hover:text-primary-600"
                        onClick={() => {
                            setSearchInput('');
                            setRole(undefined);
                        }}
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {bridge.isLoading ? (
                <HrLoadingRows />
            ) : bridge.isError ? (
                <HrErrorState
                    message="Couldn't load staff coverage."
                    onRetry={() => bridge.refetch()}
                />
            ) : rows.length === 0 ? (
                <HrEmptyState
                    icon={<UsersThree size={40} className="text-muted-foreground" />}
                    title={anyFilter ? 'Nobody matches this search' : 'No team members found'}
                    description={
                        anyFilter
                            ? 'Try a different name, or clear the role filter.'
                            : 'Invite people to your institute from Manage institute → Teams, then come back to give them HR profiles.'
                    }
                />
            ) : (
                <div className="flex flex-col gap-3">
                    <MyTable<StaffBridgeRow>
                        data={{
                            content: rows,
                            total_pages: totalPages,
                            page_no: page,
                            page_size: PAGE_SIZE,
                            total_elements: totalElements,
                            last: page >= totalPages - 1,
                        }}
                        columns={columns}
                        isLoading={false}
                        error={null}
                        currentPage={page}
                        enableColumnPinning={false}
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

            {isHrAdmin && createFor && (
                <StaffProfileDialog
                    open={!!createFor}
                    onOpenChange={(open) => {
                        if (!open) setCreateFor(null);
                    }}
                    staff={createFor}
                    departments={departments.data ?? []}
                    designations={designations.data ?? []}
                />
            )}
        </div>
    );
}
