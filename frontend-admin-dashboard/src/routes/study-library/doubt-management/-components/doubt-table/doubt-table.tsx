import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { useDoubtTable } from '../../-hooks/useDoubtTable';
import { DOUBTS_TABLE_COLUMN_WIDTHS } from '@/components/design-system/utils/constants/table-layout';
import { useDoubtTableColumns } from '../../-hooks/useDoubtColumns';

export const DoubtTable = () => {
    const { currentPage, setCurrentPage, doubts, isLoading, error } = useDoubtTable();
    const { columns } = useDoubtTableColumns();
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };
    return (
        <div className="no-scrollbar flex w-full flex-col gap-4 overflow-y-scroll sm:gap-10">
            <div className="flex w-full flex-col gap-4 sm:gap-6">
                {doubts?.content.length == 0 ? (
                    <p className="text-primary-500">No student activity found</p>
                ) : (
                    <>
                        <MyTable<Doubt>
                            currentPage={currentPage}
                            data={doubts}
                            columns={columns}
                            isLoading={isLoading}
                            error={error}
                            scrollable
                            columnWidths={DOUBTS_TABLE_COLUMN_WIDTHS}
                        />
                        {doubts && doubts.total_pages > 1 && (
                            <MyPagination
                                currentPage={currentPage}
                                totalPages={doubts.total_pages}
                                onPageChange={handlePageChange}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
