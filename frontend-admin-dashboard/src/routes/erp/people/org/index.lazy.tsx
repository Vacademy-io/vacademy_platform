import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Buildings, IdentificationBadge, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { MyButton } from '@/components/design-system/button';
import { MyTable } from '@/components/design-system/table';
import { StatusChip } from '@/components/design-system/status-chips';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useHrRole } from '@/hooks/use-hr-role';
import { reportApiError } from '@/lib/report-api-error';
import type { DepartmentDTO, DesignationDTO } from '@/routes/erp/-shared/hr-types';
import { useDeactivateDepartment, useDepartments, useDesignations } from '../-hooks/use-hr-people';
import { DepartmentFormDialog } from '../-components/DepartmentFormDialog';
import { DesignationFormDialog } from '../-components/DesignationFormDialog';
import { humanizeToken } from '../-components/EmployeeFields';
import { HrEmptyState, HrErrorState, HrLoadingRows, HrNoAccessCard } from '../-components/HrStates';

export const Route = createLazyFileRoute('/erp/people/org/')({
    component: OrgRoute,
});

function OrgRoute() {
    return (
        <LayoutContainer>
            <OrgPage />
        </LayoutContainer>
    );
}

/** One card section: heading, add button, and the table (or its loading/error/empty state). */
function OrgSection({
    title,
    description,
    action,
    children,
}: {
    title: string;
    description: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <Card className="flex flex-col">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
                <div className="flex flex-col gap-1">
                    <CardTitle className="text-title">{title}</CardTitle>
                    <p className="text-caption text-muted-foreground">{description}</p>
                </div>
                {action}
            </CardHeader>
            <CardContent className="flex-1">{children}</CardContent>
        </Card>
    );
}

function OrgPage() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">People</h1>);
    }, [setNavHeading]);

    const { isHrAdmin, isHrStaff } = useHrRole();
    const departments = useDepartments();
    const designations = useDesignations();
    const deactivateDepartment = useDeactivateDepartment();

    const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<DepartmentDTO | null>(null);
    const [designationDialogOpen, setDesignationDialogOpen] = useState(false);
    const [editingDesignation, setEditingDesignation] = useState<DesignationDTO | null>(null);
    const [confirmDeactivate, setConfirmDeactivate] = useState<DepartmentDTO | null>(null);

    // Memoized so the parent-name lookup below isn't rebuilt on every render.
    const departmentRows = useMemo(() => departments.data ?? [], [departments.data]);
    const designationRows = designations.data ?? [];

    const departmentNameById = useMemo(() => {
        const map = new Map<string, string>();
        departmentRows.forEach((row) => {
            if (row.id) map.set(row.id, row.name || row.id);
        });
        return map;
    }, [departmentRows]);

    const openDepartmentDialog = (department: DepartmentDTO | null) => {
        setEditingDepartment(department);
        setDepartmentDialogOpen(true);
    };
    const openDesignationDialog = (designation: DesignationDTO | null) => {
        setEditingDesignation(designation);
        setDesignationDialogOpen(true);
    };

    const runDeactivate = async (department: DepartmentDTO) => {
        if (!department.id) return;
        try {
            await deactivateDepartment.mutateAsync(department.id);
            toast.success(`${department.name || 'Department'} deactivated`);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-people',
                tags: { 'erp.action': 'deactivate-department' },
                extra: { departmentId: department.id },
                fallbackMessage: 'Could not deactivate this department',
            });
        }
    };

    const departmentColumns = useMemo<ColumnDef<DepartmentDTO>[]>(() => {
        const columns: ColumnDef<DepartmentDTO>[] = [
            {
                id: 'name',
                header: 'Department',
                size: 180,
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate text-body text-foreground">
                            {row.original.name || '—'}
                        </span>
                        {row.original.description && (
                            <span
                                className="truncate text-caption text-muted-foreground"
                                title={row.original.description}
                            >
                                {row.original.description}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'code',
                header: 'Code',
                size: 100,
                cell: ({ row }) => (
                    <span className="text-body text-muted-foreground">
                        {row.original.code || '—'}
                    </span>
                ),
            },
            {
                id: 'parent',
                header: 'Parent',
                size: 140,
                cell: ({ row }) => (
                    <span className="truncate text-body text-muted-foreground">
                        {row.original.parent_id
                            ? departmentNameById.get(row.original.parent_id) || '—'
                            : 'Top level'}
                    </span>
                ),
            },
            {
                id: 'status',
                header: 'Status',
                size: 110,
                cell: ({ row }) => {
                    const active = (row.original.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE';
                    return (
                        <StatusChip
                            text={humanizeToken(row.original.status || 'ACTIVE')}
                            textSize="text-caption"
                            status={active ? 'SUCCESS' : 'INFO'}
                            showIcon={false}
                        />
                    );
                },
            },
        ];

        if (isHrAdmin) {
            columns.push({
                id: 'actions',
                header: 'Actions',
                size: 100,
                cell: ({ row }) => (
                    <div className="flex items-center gap-1">
                        <MyButton
                            type="button"
                            buttonType="text"
                            scale="small"
                            layoutVariant="icon"
                            aria-label={`Edit ${row.original.name || 'department'}`}
                            onClick={() => openDepartmentDialog(row.original)}
                        >
                            <PencilSimple size={16} />
                        </MyButton>
                        <MyButton
                            type="button"
                            buttonType="text"
                            scale="small"
                            layoutVariant="icon"
                            aria-label={`Deactivate ${row.original.name || 'department'}`}
                            onClick={() => setConfirmDeactivate(row.original)}
                        >
                            <Trash size={16} className="text-danger-600" />
                        </MyButton>
                    </div>
                ),
            });
        }

        return columns;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [departmentNameById, isHrAdmin]);

    const designationColumns = useMemo<ColumnDef<DesignationDTO>[]>(() => {
        const columns: ColumnDef<DesignationDTO>[] = [
            {
                id: 'name',
                header: 'Designation',
                size: 180,
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate text-body text-foreground">
                            {row.original.name || '—'}
                        </span>
                        {row.original.description && (
                            <span
                                className="truncate text-caption text-muted-foreground"
                                title={row.original.description}
                            >
                                {row.original.description}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'code',
                header: 'Code',
                size: 100,
                cell: ({ row }) => (
                    <span className="text-body text-muted-foreground">
                        {row.original.code || '—'}
                    </span>
                ),
            },
            {
                id: 'level',
                header: 'Level',
                size: 80,
                cell: ({ row }) => (
                    <span className="block text-end text-body tabular-nums text-foreground">
                        {row.original.level ?? '—'}
                    </span>
                ),
            },
            {
                id: 'grade',
                header: 'Grade',
                size: 100,
                cell: ({ row }) => (
                    <span className="text-body text-muted-foreground">
                        {row.original.grade || '—'}
                    </span>
                ),
            },
        ];

        if (isHrAdmin) {
            columns.push({
                id: 'actions',
                header: 'Actions',
                size: 80,
                cell: ({ row }) => (
                    <MyButton
                        type="button"
                        buttonType="text"
                        scale="small"
                        layoutVariant="icon"
                        aria-label={`Edit ${row.original.name || 'designation'}`}
                        onClick={() => openDesignationDialog(row.original)}
                    >
                        <PencilSimple size={16} />
                    </MyButton>
                ),
            });
        }

        return columns;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHrAdmin]);

    if (!isHrStaff) {
        return (
            <div className="p-4 sm:p-6">
                <HrNoAccessCard />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-h2-semibold text-foreground">Departments &amp; designations</h2>
                <p className="text-body text-muted-foreground">
                    The structure every employee profile, salary template and payroll report is
                    grouped by.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <OrgSection
                    title="Departments"
                    description="Teams and their reporting hierarchy."
                    action={
                        isHrAdmin && (
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="medium"
                                onClick={() => openDepartmentDialog(null)}
                            >
                                <Plus size={16} /> Add
                            </MyButton>
                        )
                    }
                >
                    {departments.isLoading ? (
                        <HrLoadingRows rows={3} />
                    ) : departments.isError ? (
                        <HrErrorState
                            message="Couldn't load departments."
                            onRetry={() => departments.refetch()}
                        />
                    ) : departmentRows.length === 0 ? (
                        <HrEmptyState
                            icon={<Buildings size={32} className="text-muted-foreground" />}
                            title="No departments yet"
                            description="Add one so employees can be grouped for payroll and reporting."
                        >
                            {isHrAdmin && (
                                <MyButton
                                    type="button"
                                    buttonType="primary"
                                    scale="medium"
                                    onClick={() => openDepartmentDialog(null)}
                                >
                                    <Plus size={16} /> Add department
                                </MyButton>
                            )}
                        </HrEmptyState>
                    ) : (
                        <MyTable<DepartmentDTO>
                            data={{
                                content: departmentRows,
                                total_pages: 1,
                                page_no: 0,
                                page_size: departmentRows.length,
                                total_elements: departmentRows.length,
                                last: true,
                            }}
                            columns={departmentColumns}
                            isLoading={false}
                            error={null}
                            currentPage={0}
                            enableColumnPinning={false}
                            scrollable
                        />
                    )}
                </OrgSection>

                <OrgSection
                    title="Designations"
                    description="Job titles, their seniority level and grade."
                    action={
                        isHrAdmin && (
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="medium"
                                onClick={() => openDesignationDialog(null)}
                            >
                                <Plus size={16} /> Add
                            </MyButton>
                        )
                    }
                >
                    {designations.isLoading ? (
                        <HrLoadingRows rows={3} />
                    ) : designations.isError ? (
                        <HrErrorState
                            message="Couldn't load designations."
                            onRetry={() => designations.refetch()}
                        />
                    ) : designationRows.length === 0 ? (
                        <HrEmptyState
                            icon={
                                <IdentificationBadge size={32} className="text-muted-foreground" />
                            }
                            title="No designations yet"
                            description="Add the job titles you hire for — salary templates key off them."
                        >
                            {isHrAdmin && (
                                <MyButton
                                    type="button"
                                    buttonType="primary"
                                    scale="medium"
                                    onClick={() => openDesignationDialog(null)}
                                >
                                    <Plus size={16} /> Add designation
                                </MyButton>
                            )}
                        </HrEmptyState>
                    ) : (
                        <MyTable<DesignationDTO>
                            data={{
                                content: designationRows,
                                total_pages: 1,
                                page_no: 0,
                                page_size: designationRows.length,
                                total_elements: designationRows.length,
                                last: true,
                            }}
                            columns={designationColumns}
                            isLoading={false}
                            error={null}
                            currentPage={0}
                            enableColumnPinning={false}
                            scrollable
                        />
                    )}
                </OrgSection>
            </div>

            {isHrAdmin && (
                <>
                    <DepartmentFormDialog
                        open={departmentDialogOpen}
                        onOpenChange={(open) => {
                            setDepartmentDialogOpen(open);
                            if (!open) setEditingDepartment(null);
                        }}
                        department={editingDepartment}
                        departments={departmentRows}
                    />
                    <DesignationFormDialog
                        open={designationDialogOpen}
                        onOpenChange={(open) => {
                            setDesignationDialogOpen(open);
                            if (!open) setEditingDesignation(null);
                        }}
                        designation={editingDesignation}
                    />
                    <AlertDialog
                        open={!!confirmDeactivate}
                        onOpenChange={(open) => {
                            if (!open) setConfirmDeactivate(null);
                        }}
                    >
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    Deactivate {confirmDeactivate?.name || 'this department'}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    It stops being offered when assigning employees. Existing
                                    employees keep their department on record, so payroll history
                                    stays intact.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-danger-500 hover:bg-danger-600"
                                    onClick={() => {
                                        if (confirmDeactivate)
                                            void runDeactivate(confirmDeactivate);
                                        setConfirmDeactivate(null);
                                    }}
                                >
                                    Deactivate
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}
        </div>
    );
}
