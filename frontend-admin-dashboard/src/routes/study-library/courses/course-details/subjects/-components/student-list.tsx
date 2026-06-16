import { useStudentFilters } from '@/routes/manage-students/students-list/-hooks/useStudentFilters';
import { useStudentTable } from '@/routes/manage-students/students-list/-hooks/useStudentTable';
import { useStudentCounts } from '@/routes/manage-students/students-list/-hooks/useStudentCounts';
import { InviteFormProvider } from '@/routes/manage-students/invite/-context/useInviteFormContext';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { EmptyStudentListImage } from '@/assets/svgs';
import { SidebarProvider } from '@/components/ui/sidebar';
import { MyTable } from '@/components/design-system/table';
import { StudentTable } from '@/types/student-table-types';
import { StudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-side-view';
import { MyPagination } from '@/components/design-system/pagination';
import { IndividualShareCredentialsDialog } from '@/routes/manage-students/students-list/-components/students-list/student-list-section/bulk-actions/individual-share-credentials-dialog';
import {
    getColumnsVisibility,
    getCustomColumns,
} from '@/components/design-system/utils/constants/table-column-data';
import { STUDENT_LIST_COLUMN_WIDTHS } from '@/components/design-system/utils/constants/table-layout';
import { OnChangeFn, RowSelectionState } from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { StudentListHeader } from '@/routes/manage-students/students-list/-components/students-list/student-list-section/student-list-header';
import { DropdownItemType } from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { StudentFilters } from '@/routes/manage-students/students-list/-components/students-list/student-list-section/student-filters';
import { GetFilterData } from '@/routes/manage-students/students-list/-constants/all-filters';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { BulkActions } from '@/routes/manage-students/students-list/-components/students-list/student-list-section/bulk-actions/bulk-actions';
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INVITE_LINKS } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { getDisplaySettingsFromCache } from '@/services/display-settings';
import {
    getCustomFieldSettingsFromCache,
    getCustomFieldSettings,
} from '@/services/custom-field-settings';

const Students = ({
    packageSessionId,
    currentSession,
}: {
    packageSessionId: string;
    currentSession: DropdownItemType;
}) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { instituteDetails } = useInstituteDetailsStore();
    const [rowSelections, setRowSelections] = useState<Record<number, Record<string, boolean>>>({});
    const tableRef = useRef<HTMLDivElement>(null);
    const [allPagesData, setAllPagesData] = useState<Record<number, StudentTable[]>>({});

    // Prime the custom-field settings cache so getCustomColumns() (which appends the
    // custom-field columns) and the visibility readers below have data on first mount —
    // mirrors the main Learner List. On a cold cache the tab would otherwise render no
    // custom columns. Bump a version after fetch to recompute the column visibility.
    const [, bumpCustomFieldsVersion] = useState(0);
    useEffect(() => {
        getCustomFieldSettings()
            .then(() => bumpCustomFieldsVersion((v) => v + 1))
            .catch(() => {});
    }, []);

    // Role-based column visibility — identical layering to the main Learner List
    // (students-list-section.tsx) so this tab shows the SAME columns the admin sees
    // there, including the custom fields the active role has opted into.
    const roleHiddenColumns = useMemo(() => {
        const roleKey = getActiveRoleDisplaySettingsKey();
        const cached = getDisplaySettingsFromCache(roleKey);
        return new Set(cached?.learnerListColumns?.hiddenColumns ?? []);
    }, []);
    const roleEnabledCustomFields = useMemo(() => {
        const roleKey = getActiveRoleDisplaySettingsKey();
        const cached = getDisplaySettingsFromCache(roleKey);
        return new Set(cached?.learnerListColumns?.enabledCustomFields ?? []);
    }, []);
    // Every custom-field accessor known for this institute. Anything here that is NOT in
    // roleEnabledCustomFields gets force-hidden (custom fields are opt-in per role).
    const allCustomFieldAccessors = useMemo(() => {
        const cache = getCustomFieldSettingsFromCache();
        if (!cache) return new Set<string>();
        const all = [
            ...cache.instituteFields,
            ...cache.customFields,
            ...cache.fieldGroups.flatMap((g) => g.fields),
        ];
        return new Set(all.map((f) => f.id).filter(Boolean));
    }, []);
    const hasOrgAssociatedBatches = useMemo(
        () =>
            (instituteDetails?.batches_for_sessions || []).some(
                (b) => b.is_org_associated === true
            ),
        [instituteDetails]
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element | null;
            // Side-view panel + any portaled overlay (dialog, menu, popover/select,
            // toast) render at <body>, outside tableRef. Treat clicks inside them as
            // "inside" so e.g. closing the Assign-Course dialog doesn't also close
            // the side view.
            if (
                target?.closest(
                    '[data-sidebar="sidebar"],[role="dialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper],[data-sonner-toaster]'
                )
            )
                return;
            if (
                tableRef.current &&
                !tableRef.current.contains(event.target as Node) &&
                isSidebarOpen
            ) {
                setIsSidebarOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSidebarOpen]);

    const {
        columnFilters,
        clearFilters,
        searchInput,
        appliedFilters: baseAppliedFilters,
        searchFilter,
        sessionList,
        getActiveFiltersState,
        handleFilterChange,
        handleFilterClick,
        handleClearFilters,
        handleSearchInputChange,
        handleSearchEnter,
        handleClearSearch,
        setAppliedFilters,
        handleSessionChange,
    } = useStudentFilters();
    const appliedFilters = useMemo(
        () => ({
            ...baseAppliedFilters,
            package_session_ids: [packageSessionId],
        }),
        [baseAppliedFilters, packageSessionId]
    );
    const {
        studentTableData,
        isLoading: loadingData,
        error: loadingError,
        page,
        handleSort,
        handlePageChange,
    } = useStudentTable(appliedFilters, setAppliedFilters, [packageSessionId]);

    // Header Total/Active/Inactive badges. appliedFilters already pins this batch's
    // package_session_ids, so the counts match the table below (and the third arg is a
    // belt-and-suspenders fallback for the hook's empty-batch path).
    const studentCounts = useStudentCounts(appliedFilters, !loadingData, [packageSessionId]);

    // Fetch accessible invites for this package session (API-filtered by FSPSSM)
    const instituteId = getInstituteId();
    const { data: invitesForFilter } = useQuery({
        queryKey: ['invite-filter-list', packageSessionId, instituteId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.post(
                `${GET_INVITE_LINKS}?instituteId=${instituteId}&pageNo=0&pageSize=100`,
                { search_name: '', package_session_ids: [packageSessionId], payment_option_ids: [], sort_columns: {}, tags: [] }
            );
            return (response.data?.content || [])
                .filter((inv: { tag?: string | null }) => {
                    const tag = (inv.tag ?? '').trim().toUpperCase();
                    // Hide only the bare SUB_ORG admin/scoped invites; the SUBORG_LEARNER
                    // invite must be selectable so admins can filter enrolled learners by
                    // it (which also drives the backend's invite-name column population).
                    return tag !== 'SUB_ORG';
                })
                .map((inv: { id: string; name: string }) => ({
                    id: inv.id,
                    label: inv.name || inv.id,
                }));
        },
        enabled: !!packageSessionId && !!instituteId,
        staleTime: 1000 * 60 * 5,
    });

    const filters = [
        ...GetFilterData(instituteDetails, currentSession?.id).filter(
            (filter) => filter.id !== 'batch'
        ),
        ...(invitesForFilter && invitesForFilter.length > 0
            ? [{ id: 'enroll_invite_ids', title: getTerminology(OtherTerms.Invite, SystemTerms.Invite), filterList: invitesForFilter }]
            : []),
    ];
    const currentPageSelection = rowSelections[page] || {};

    useEffect(() => {
        if (studentTableData?.content) {
            setAllPagesData((prev) => ({
                ...prev,
                [page]: studentTableData.content,
            }));
        }
    }, [studentTableData?.content, page]);

    const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updaterOrValue) => {
        const newSelection =
            typeof updaterOrValue === 'function'
                ? updaterOrValue(rowSelections[page] || {})
                : updaterOrValue;

        setRowSelections((prev) => ({
            ...prev,
            [page]: newSelection,
        }));
    };

    const handleResetSelections = () => {
        setRowSelections({});
    };

    const getSelectedStudents = (): StudentTable[] => {
        return Object.entries(rowSelections).flatMap(([pageNum, selections]) => {
            const pageData = allPagesData[parseInt(pageNum)];
            if (!pageData) return [];

            return Object.entries(selections)
                .filter(([, isSelected]) => isSelected)
                .map(([index]) => pageData[parseInt(index)])
                .filter((student): student is StudentTable => student !== undefined);
        });
    };

    const getSelectedStudentIds = (): string[] => {
        return getSelectedStudents().map((student) => student.id);
    };

    const totalSelectedCount = Object.values(rowSelections).reduce(
        (count, pageSelection) => count + Object.keys(pageSelection).length,
        0
    );

    return (
        <section className="flex  flex-col">
            <div className="flex flex-col gap-4 ">
                <InviteFormProvider>
                    {/* <BulkDialogProvider>
                    <EnrollStudentsButton scale="medium" />
                </BulkDialogProvider> */}
                    <StudentListHeader
                        currentSession={currentSession}
                        titleSize="text-base"
                        packageSessionId={packageSessionId}
                        total={studentCounts.total}
                        active={studentCounts.active}
                        inactive={studentCounts.inactive}
                        countsLoading={studentCounts.isLoading}
                    />
                </InviteFormProvider>
                {/* Filter section here */}
                <StudentFilters
                    currentSession={currentSession}
                    filters={filters}
                    searchInput={searchInput}
                    searchFilter={searchFilter}
                    columnFilters={columnFilters}
                    clearFilters={clearFilters}
                    getActiveFiltersState={getActiveFiltersState}
                    onSessionChange={handleSessionChange}
                    onSearchChange={handleSearchInputChange}
                    onSearchEnter={handleSearchEnter}
                    onClearSearch={handleClearSearch}
                    onFilterChange={handleFilterChange}
                    onFilterClick={handleFilterClick}
                    onClearFilters={handleClearFilters}
                    appliedFilters={appliedFilters}
                    page={page}
                    pageSize={10}
                    totalElements={studentTableData?.total_elements || 0}
                    sessionList={sessionList}
                />
                {loadingData ? (
                    <div className="flex w-full flex-col items-center gap-3 text-neutral-600">
                        <DashboardLoader />
                    </div>
                ) : !studentTableData || studentTableData.content.length == 0 ? (
                    <div className="flex w-full flex-col items-center gap-3 text-neutral-600">
                        <EmptyStudentListImage />
                        <p>No student data available</p>
                    </div>
                ) : (
                    <div className="flex w-auto flex-col gap-5">
                        <div className="relative flex h-auto">
                            <div className="overflow-hidden" ref={tableRef}>
                                <SidebarProvider
                                    style={{ ['--sidebar-width' as string]: '500px' }}
                                    defaultOpen={false}
                                    open={isSidebarOpen}
                                    onOpenChange={setIsSidebarOpen}
                                >
                                    <MyTable<StudentTable>
                                        data={{
                                            content: studentTableData.content.map((student) => ({
                                                ...student,
                                                id: student.user_id,
                                            })),
                                            total_pages: studentTableData.total_pages,
                                            page_no: studentTableData.page_no,
                                            page_size: studentTableData.page_size,
                                            total_elements: studentTableData.total_elements,
                                            last: studentTableData.last,
                                        }}
                                        columns={getCustomColumns(
                                            // Show approval actions if INVITED or
                                            // PENDING_FOR_APPROVAL is in the status filter.
                                            appliedFilters.statuses?.some((s) =>
                                                ['INVITED', 'PENDING_FOR_APPROVAL'].includes(s)
                                            ) || false
                                        )}
                                        tableState={{
                                            columnVisibility: (() => {
                                                // Same layering as the main Learner List:
                                                // institute system-field visibility, then role
                                                // hidden columns, then force-hide custom fields
                                                // not opted in for this role, then filter-driven
                                                // overrides.
                                                const base = getColumnsVisibility();
                                                roleHiddenColumns.forEach((accessor) => {
                                                    base[accessor] = false;
                                                });
                                                allCustomFieldAccessors.forEach((accessor) => {
                                                    if (!roleEnabledCustomFields.has(accessor)) {
                                                        base[accessor] = false;
                                                    }
                                                });
                                                const paymentFilterApplied =
                                                    (appliedFilters.payment_statuses?.length ?? 0) >
                                                    0;
                                                const enrollInviteFilterApplied =
                                                    (appliedFilters.enroll_invite_ids?.length ?? 0) >
                                                    0;
                                                return {
                                                    ...base,
                                                    // This tab is already scoped to one batch, so
                                                    // the batch column is redundant here.
                                                    package_session_id: false,
                                                    enroll_invite_name: enrollInviteFilterApplied,
                                                    plan_type: paymentFilterApplied,
                                                    amount_paid: paymentFilterApplied,
                                                    preffered_batch: false,
                                                    membership_role:
                                                        hasOrgAssociatedBatches &&
                                                        roleEnabledCustomFields.has(
                                                            'membership_role'
                                                        ),
                                                    membership_type:
                                                        hasOrgAssociatedBatches &&
                                                        roleEnabledCustomFields.has(
                                                            'membership_type'
                                                        ),
                                                };
                                            })(),
                                        }}
                                        isLoading={loadingData}
                                        error={loadingError}
                                        onSort={handleSort}
                                        columnWidths={STUDENT_LIST_COLUMN_WIDTHS}
                                        rowSelection={currentPageSelection}
                                        onRowSelectionChange={handleRowSelectionChange}
                                        currentPage={page}
                                        scrollable={false} // Change this to false to prevent horizontal scrolling
                                        className="w-full" // Add this to ensure table takes full width
                                    />
                                    <div>
                                        <StudentSidebar
                                            selectedTab={'ENDED,PENDING,LIVE'}
                                            examType={'EXAM'}
                                            isStudentList={true}
                                            packageSessionId={packageSessionId}
                                        />
                                    </div>
                                </SidebarProvider>
                            </div>
                        </div>
                        <div className="flex">
                            <BulkActions
                                selectedCount={totalSelectedCount}
                                selectedStudentIds={getSelectedStudentIds()}
                                selectedStudents={getSelectedStudents()}
                                onReset={handleResetSelections}
                            />
                            <MyPagination
                                currentPage={page}
                                totalPages={studentTableData?.total_pages || 1}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    </div>
                )}
            </div>
            <IndividualShareCredentialsDialog />
        </section>
    );
};

export default Students;
