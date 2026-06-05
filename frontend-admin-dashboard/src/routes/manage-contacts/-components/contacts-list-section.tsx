import { useState, useRef, useEffect } from 'react';
import { useContactFilters } from '../-hooks/useContactFilters';
import { useContactTable } from '../-hooks/useContactTable';
import { ContactFilters } from './contact-filters';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { DashboardLoader, ErrorBoundary } from '@/components/core/dashboard-loader';
import { SmartErrorPage } from '@/components/core/SmartErrorPage';
import { SidebarProvider } from '@/components/ui/sidebar';
import { StudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-side-view';
import { StudentSidebarProvider } from '@/routes/manage-students/students-list/-providers/student-sidebar-provider';
import { ContactUser } from '../-types/contact-types';
import { getContactColumns } from './contacts-table-columns';
import EmptyStudentListImage from '@/assets/svgs/empty-students-image.svg';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import { AssignCounselorToLeadDialog } from '@/components/shared/assign-counselor-to-lead-dialog';
import { getSystemFieldColumnVisibility } from '@/components/design-system/utils/constants/system-field-columns';
import { getCustomFieldSettings } from '@/services/custom-field-settings';

export const ContactsListSection = () => {
    const { setNavHeading } = useNavHeadingStore();
    const filters = useContactFilters();
    const { contactTableData, isLoading, error, handleSort, handlePageChange, page } =
        useContactTable(filters.appliedFilters, filters.setAppliedFilters);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const tableRef = useRef<HTMLDivElement>(null);

    // Keep the custom-field settings cache fresh (it's cleared on save) and
    // re-render so the column-visibility recomputes — otherwise the readers fail
    // open and show columns that were toggled off.
    const [, bumpCustomFieldsVersion] = useState(0);
    useEffect(() => {
        getCustomFieldSettings()
            .then(() => bumpCustomFieldsVersion((v) => v + 1))
            .catch(() => {});
    }, []);

    const leadSettings = useLeadSettings();
    // Don't render lead UI while settings are loading (defaults have enabled:true which would flash)
    const leadReady = !leadSettings.isLoading && leadSettings.enabled;
    const showLeadScore = leadReady && leadSettings.showScoreInContactsTable;
    const showCounselor = leadReady;

    const [assignDialog, setAssignDialog] = useState<{ userId: string; userName: string } | null>(null);

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Contacts</h1>);
    }, []);

    // Close sidebar on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                tableRef.current &&
                !tableRef.current.contains(event.target as Node) &&
                isSidebarOpen
            ) {
                // Check if the click was on the sidebar itself, if not close it
                // Actually SidebarProvider handles some of this, but StudentListSection had this logic.
                // We'll rely on SidebarProvider's onOpenChange for now, or the trigger.

                // If the sidebar is rendered inside SidebarProvider which is inside "tableRef" div...
                // The logical "outside" might be tricky.
                // StudentListSection implements this, so let's keep it if needed.
                setIsSidebarOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSidebarOpen]);

    const EmptyState = () => (
        <div className="animate-fadeIn flex flex-col items-center justify-center px-3 py-8 text-center">
            <div className="mb-3 rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 p-3 shadow-inner">
                <EmptyStudentListImage className="size-12 opacity-50" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-neutral-700">No Contacts Found</h3>
            <p className="mb-4 max-w-md text-xs leading-relaxed text-neutral-500">
                No contact data matches your current filters.
            </p>
        </div>
    );

    if (error) return <SmartErrorPage />;

    // Columns — counsellor assign callback only when lead system is active
    const columns = getContactColumns(
        handleSort,
        showLeadScore,
        showCounselor ? (userId, userName) => setAssignDialog({ userId, userName }) : undefined,
        showCounselor
    );

    return (
        <ErrorBoundary>
            {leadReady && assignDialog && (
                <AssignCounselorToLeadDialog
                    open={!!assignDialog}
                    onOpenChange={(open) => {
                        if (!open) setAssignDialog(null);
                    }}
                    userId={assignDialog.userId}
                    userName={assignDialog.userName}
                />
            )}
            <StudentSidebarProvider>
                <section className="animate-fadeIn flex max-w-full flex-col gap-3 overflow-visible">
                    <ContactFilters filters={filters} />

                    {isLoading ? (
                        <div className="flex w-full flex-col items-center gap-2 py-6">
                            <DashboardLoader />
                            <p className="animate-pulse text-xs text-neutral-500">
                                Loading contacts...
                            </p>
                        </div>
                    ) : !contactTableData || contactTableData.users.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="animate-slideInRight flex flex-col gap-2">
                            <div className="overflow-hidden rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 shadow-sm">
                                <div className="max-w-full" ref={tableRef}>
                                    <SidebarProvider
                                        style={{ ['--sidebar-width' as string]: '565px' }}
                                        defaultOpen={false}
                                        open={isSidebarOpen}
                                        onOpenChange={setIsSidebarOpen}
                                    >
                                        <MyTable<ContactUser>
                                            data={{
                                                content: contactTableData.users,
                                                total_pages: contactTableData.total_pages,
                                                page_no: contactTableData.current_page,
                                                page_size: contactTableData.page_size,
                                                total_elements: contactTableData.total_elements,
                                                last: contactTableData.is_last,
                                            }}
                                            columns={columns}
                                            tableState={{
                                                columnVisibility: (() => {
                                                    // Preserve existing visibility (none today),
                                                    // then hide any system field toggled off in
                                                    // Settings → Custom Fields. Contacts columns use
                                                    // `user.<accessor>` ids.
                                                    const visibility: Record<string, boolean> = {};
                                                    const systemVis = getSystemFieldColumnVisibility();
                                                    (
                                                        [
                                                            'full_name',
                                                            'username',
                                                            'email',
                                                            'mobile_number',
                                                            'gender',
                                                            'region',
                                                            'city',
                                                        ] as const
                                                    ).forEach((accessor) => {
                                                        if (systemVis[accessor] === false) {
                                                            visibility[`user.${accessor}`] = false;
                                                        }
                                                    });
                                                    return visibility;
                                                })(),
                                            }}
                                            isLoading={isLoading}
                                            error={error}
                                            onSort={handleSort}
                                            columnWidths={{}} // Default widths
                                            currentPage={page}
                                        />
                                        <div>
                                            <StudentSidebar
                                                selectedTab={'overview'}
                                                examType={'EXAM'}
                                                isStudentList={false} // Maybe acts differently?
                                            />
                                        </div>
                                    </SidebarProvider>
                                </div>
                            </div>

                            <div className="flex justify-center lg:justify-end">
                                <MyPagination
                                    currentPage={page}
                                    totalPages={contactTableData?.total_pages || 1}
                                    onPageChange={handlePageChange}
                                />
                            </div>
                        </div>
                    )}
                </section>
            </StudentSidebarProvider>
        </ErrorBoundary>
    );
};
