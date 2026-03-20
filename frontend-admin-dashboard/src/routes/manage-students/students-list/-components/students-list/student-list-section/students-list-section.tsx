// StudentListSection.tsx
import { useEffect, useState, useRef } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { GetFilterData } from '@/routes/manage-students/students-list/-constants/all-filters';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { StudentListHeader } from './student-list-header';
import { StudentFilters } from './student-filters';
import { useStudentFilters } from '@/routes/manage-students/students-list/-hooks/useStudentFilters';
import { useStudentTable } from '@/routes/manage-students/students-list/-hooks/useStudentTable';
import { StudentTable } from '@/types/student-table-types';
import {
    getColumnsVisibility,
    getCustomColumns,
} from '@/components/design-system/utils/constants/table-column-data';
import { STUDENT_LIST_COLUMN_WIDTHS } from '@/components/design-system/utils/constants/table-layout';
import { BulkActions } from './bulk-actions/bulk-actions';
import { OnChangeFn, RowSelectionState } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { DashboardLoader, ErrorBoundary } from '@/components/core/dashboard-loader';
import RootErrorComponent from '@/components/core/deafult-error';
import { SidebarProvider } from '@/components/ui/sidebar';
import { StudentSidebar } from '../student-side-view/student-side-view';
import EmptyStudentListImage from '@/assets/svgs/empty-students-image.svg';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { NoCourseDialog } from '@/components/common/students/no-course-dialog';
import { useSearch } from '@tanstack/react-router';
import { Route } from '@/routes/manage-students/students-list';
import { DropdownItemType } from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { ShareCredentialsDialog } from './bulk-actions/share-credentials-dialog';
import { IndividualShareCredentialsDialog } from './bulk-actions/individual-share-credentials-dialog';
import { SendMessageDialog } from './bulk-actions/send-message-dialog';
import { SendEmailDialog } from './bulk-actions/send-email-dialog';
import { AcceptRequestDialog } from '@/routes/manage-students/enroll-requests/-components/bulk-actions/bulk-actions-component/accept-request-dialog';
import { DeclineRequestDialog } from '@/routes/manage-students/enroll-requests/-components/bulk-actions/bulk-actions-component/decline-request-dialog';
import { InviteFormProvider } from '@/routes/manage-students/invite/-context/useInviteFormContext';
import { Users, FileMagnifyingGlass } from '@phosphor-icons/react';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export const StudentsListSection = () => {
    const { setNavHeading } = useNavHeadingStore();
    const { isError, isLoading } = useQuery(useInstituteQuery());
    const [isOpen, setIsOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { getCourseFromPackage, instituteDetails } =
        useInstituteDetailsStore();
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
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

    useEffect(() => {
        const courseList = getCourseFromPackage();
        if (courseList.length === 0) {
            setIsOpen(true);
        }
    }, [instituteDetails]);

    useEffect(() => {
        setNavHeading(
            <h1 className="text-lg">{getTerminology(RoleTerms.Learner, SystemTerms.Learner)}s</h1>
        );
    }, []);

    const {
        columnFilters,
        appliedFilters,
        clearFilters,
        searchInput,
        searchFilter,
        currentSession,
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
        setColumnFilters,
    } = useStudentFilters();

    const filters = GetFilterData(instituteDetails, currentSession.id);

    const search = useSearch({ from: Route.id });

    const {
        studentTableData,
        isLoading: loadingData,
        error: loadingError,
        page,
        handleSort,
        handlePageChange,
    } = useStudentTable(
        appliedFilters,
        setAppliedFilters,
        search.package_session_id ? [search.package_session_id] : null
    );

    const [allPagesData, setAllPagesData] = useState<Record<number, StudentTable[]>>({});
    useEffect(() => {
        if (studentTableData?.content) {
            setAllPagesData((prev) => ({
                ...prev,
                [page]: studentTableData.content,
            }));
        }
    }, [studentTableData?.content, page]);

    const [rowSelections, setRowSelections] = useState<Record<number, Record<string, boolean>>>({});

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

            console.log(pageData);

            return Object.entries(selections)
                .filter(([, isSelected]) => isSelected)
                .map(([index]) => pageData[parseInt(index)])
                .filter((student): student is StudentTable => student !== undefined);
        });
    };

    const getSelectedStudentIds = (): string[] => {
        return getSelectedStudents().map((student) => student.id);
    };

    const currentPageSelection = rowSelections[page] || {};
    const totalSelectedCount = Object.values(rowSelections).reduce(
        (count, pageSelection) => count + Object.keys(pageSelection).length,
        0
    );


    if (isLoading) return <DashboardLoader />;
    if (isError) return <RootErrorComponent />;

    // Enhanced empty state component
    const EmptyState = () => (
        <div className="animate-fadeIn flex flex-col items-center justify-center px-3 py-8 text-center">
            <div className="mb-3 rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 p-3 shadow-inner">
                <EmptyStudentListImage className="size-12 opacity-50" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-neutral-700">
                No {getTerminology(RoleTerms.Learner, SystemTerms.Learner)} Found
            </h3>
            <p className="mb-4 max-w-md text-xs leading-relaxed text-neutral-500">
                No {getTerminology(RoleTerms.Learner, SystemTerms.Learner).toLocaleLowerCase()} data
                matches your current filters. Try adjusting your search criteria or add new{' '}
                {getTerminology(RoleTerms.Learner, SystemTerms.Learner).toLocaleLowerCase()} to get
                started.
            </p>
            <div className="flex flex-col items-center gap-2 sm:flex-row">
                <InviteFormProvider>
                    <button className="hover:to-primary-700 group flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 px-3 py-1.5 text-sm text-white shadow-md transition-all duration-200 hover:scale-105 hover:from-primary-600">
                        <Users className="size-3.5 transition-transform duration-200 group-hover:scale-110" />
                        Invite {getTerminology(RoleTerms.Learner, SystemTerms.Learner)}
                    </button>
                </InviteFormProvider>
                <button
                    onClick={handleClearFilters}
                    className="group flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 transition-all duration-200 hover:scale-105 hover:bg-neutral-200"
                >
                    <FileMagnifyingGlass className="size-3.5 transition-transform duration-200 group-hover:scale-110" />
                    Clear Filters
                </button>
            </div>
        </div>
    );

    const handleResetAll = () => {
        handleClearFilters();
    };

    return (
        <ErrorBoundary>
            <section className="animate-fadeIn flex max-w-full flex-col gap-3 overflow-visible">
                <div className="flex flex-col gap-3">
                    <InviteFormProvider>
                        <StudentListHeader currentSession={currentSession} />
                    </InviteFormProvider>

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
                        onClearFilters={handleResetAll}
                        appliedFilters={appliedFilters}
                        page={page}
                        pageSize={10}
                        totalElements={studentTableData?.total_elements || 0}
                        sessionList={sessionList}
                    />

                    {loadingData ? (
                        <div className="flex w-full flex-col items-center gap-2 py-6">
                            <DashboardLoader />
                            <p className="animate-pulse text-xs text-neutral-500">
                                Loading{' '}
                                {getTerminology(
                                    RoleTerms.Learner,
                                    SystemTerms.Learner
                                ).toLocaleLowerCase()}{' '}
                                data...
                            </p>
                        </div>
                    ) : !studentTableData || studentTableData.content.length == 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="animate-slideInRight flex flex-col gap-2">
                            {/* Modern table container */}
                            <div className="overflow-hidden rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 shadow-sm">
                                <div className="max-w-full" ref={tableRef}>
                                    <SidebarProvider
                                        style={{ ['--sidebar-width' as string]: '565px' }}
                                        defaultOpen={false}
                                        open={isSidebarOpen}
                                        onOpenChange={setIsSidebarOpen}
                                    >
                                        <MyTable<StudentTable>
                                            data={{
                                                content: studentTableData.content.map(
                                                    (student) => ({
                                                        ...student,
                                                        id: student.user_id,
                                                    })
                                                ),
                                                total_pages: studentTableData.total_pages,
                                                page_no: studentTableData.page_no,
                                                page_size: studentTableData.page_size,
                                                total_elements: studentTableData.total_elements,
                                                last: studentTableData.last,
                                            }}
                                            columns={getCustomColumns(
                                                // Show approval actions if INVITED or PENDING_FOR_APPROVAL is in statuses
                                                appliedFilters.statuses?.some(s =>
                                                    ['INVITED', 'PENDING_FOR_APPROVAL'].includes(s)
                                                ) || false
                                            )}
                                            tableState={{
                                                columnVisibility: getColumnsVisibility(),
                                            }}
                                            isLoading={loadingData}
                                            error={loadingError}
                                            onSort={handleSort}
                                            columnWidths={STUDENT_LIST_COLUMN_WIDTHS}
                                            rowSelection={currentPageSelection}
                                            onRowSelectionChange={handleRowSelectionChange}
                                            currentPage={page}
                                        />
                                        <div>
                                            <StudentSidebar
                                                selectedTab={'ENDED,PENDING,LIVE'}
                                                examType={'EXAM'}
                                                isStudentList={true}
                                            />
                                        </div>
                                    </SidebarProvider>
                                </div>
                            </div>

                            {/* Enhanced footer with bulk actions and pagination */}
                            <div className="flex flex-col justify-between gap-2 rounded-lg border border-neutral-200/50 bg-gradient-to-r from-neutral-50/50 to-white px-3 py-2 lg:flex-row lg:items-center">
                                <BulkActions
                                    selectedCount={totalSelectedCount}
                                    selectedStudentIds={getSelectedStudentIds()}
                                    selectedStudents={getSelectedStudents()}
                                    onReset={handleResetSelections}
                                />
                                <div className="flex justify-center lg:justify-end">
                                    <MyPagination
                                        currentPage={page}
                                        totalPages={studentTableData?.total_pages || 1}
                                        onPageChange={handlePageChange}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <NoCourseDialog
                    isOpen={isOpen}
                    setIsOpen={setIsOpen}
                    type="Enroll Students"
                    content="You need to create a course and add a subject in it before"
                />
                <ShareCredentialsDialog />
                <IndividualShareCredentialsDialog />
                <SendMessageDialog />
                <SendEmailDialog />
                <AcceptRequestDialog />
                <DeclineRequestDialog />
            </section>
        </ErrorBoundary>
    );
};
