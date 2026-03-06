import { useState, useRef, useEffect } from 'react';
import { useContactFilters } from '../-hooks/useContactFilters';
import { useContactTable } from '../-hooks/useContactTable';
import { ContactFilters } from './contact-filters';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { DashboardLoader, ErrorBoundary } from '@/components/core/dashboard-loader';
import RootErrorComponent from '@/components/core/deafult-error';
import { SidebarProvider } from '@/components/ui/sidebar';
import { StudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-side-view';
import { StudentSidebarContext } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { StudentSidebarProvider } from '@/routes/manage-students/students-list/-providers/student-sidebar-provider';
import { StudentTable } from '@/types/student-table-types';
import { ContactUser } from '../-types/contact-types';
import { getContactColumns } from './contacts-table-columns';
import EmptyStudentListImage from '@/assets/svgs/empty-students-image.svg';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';

export const ContactsListSection = () => {
    const { setNavHeading } = useNavHeadingStore();
    const filters = useContactFilters();
    const { contactTableData, isLoading, error, handleSort, handlePageChange, page } =
        useContactTable(filters.appliedFilters, filters.setAppliedFilters);
    const [selectedStudent, setSelectedStudent] = useState<StudentTable | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const tableRef = useRef<HTMLDivElement>(null);

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

        const sidebarElement = document.querySelector('[data-radix-collection-item]'); // Radix sidebar?
        // Actually StudentListSection attaches mousedown to document.
        // Let's replicate if we want exactly same behavior.
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

    if (error) return <RootErrorComponent />;

    // Columns
    const columns = getContactColumns(handleSort);

    return (
        <ErrorBoundary>
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
                                                columnVisibility: {},
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
