import {
    ActivityStatsColumns,
    ActivityStatsColumnsType,
} from '@/components/design-system/utils/constants/table-column-data';
import { MyPagination } from '@/components/design-system/pagination';
import { usePaginationState } from '@/hooks/pagination';
import { useMemo, useState } from 'react';
import { ACTIVITY_STATS_COLUMN_WIDTHS } from '@/components/design-system/utils/constants/table-layout';
import { MyTable } from '@/components/design-system/table';
import { MyButton } from '@/components/design-system/button';
import { StudentSearchBox } from '@/components/common/student-search-box';
import { ActivityLogDialog } from '@/components/common/student-slide-tracking/activity-log-dialog';
import { Dialog, DialogHeader, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useRouter } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getSlideActivityStats } from '@/services/study-library/slide-operations/slide-activity-stats';
import { UserActivity } from '@/types/study-library/activity-stats-response-type';

export const ActivityStatsSidebar = () => {
    const [searchInput, setSearchInput] = useState('');

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value);
    };
    const router = useRouter();
    const { slideId } = router.state.location.search;

    const { page, pageSize, handlePageChange } = usePaginationState({
        initialPage: 0,
        initialPageSize: 4,
    });

    const {
        data: activityStats,
        isLoading,
        error,
    } = useQuery(
        getSlideActivityStats({
            slideId: slideId as string,
            page,
            size: pageSize,
        })
    );

    const formatTimeSpent = (timeInSeconds: number) => {
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = timeInSeconds % 60;

        return `${hours}h ${minutes}m ${seconds}s`;
    };
    const tableData = useMemo(() => {
        if (!activityStats)
            return {
                content: [],
                total_pages: 0,
                page_no: 0,
                page_size: pageSize,
                total_elements: 0,
                last: true,
            };

        const transformedContent = activityStats.content.map((item: UserActivity) => ({
            id: item.userId, // Using userId as id
            full_name: item.fullName,
            time_spent: formatTimeSpent(item.totalTimeSpent), // You'll need to implement this
            last_active: new Date(item.lastActive).toLocaleString(),
            user_id: item.userId,
        }));

        return {
            content: transformedContent,
            total_pages: activityStats.totalPages,
            page_no: page,
            page_size: pageSize,
            total_elements: activityStats.totalElements,
            last: activityStats.last,
        };
    }, [activityStats, page, pageSize]);

    // Helper function to format time spent

    return (
        <Dialog>
            <DialogTrigger asChild>
                <MyButton buttonType="secondary" scale="medium" layoutVariant="default">
                    Activity Stats
                </MyButton>
            </DialogTrigger>
            <DialogContent className="w-[800px] max-w-[800px] p-0 font-normal">
                <DialogHeader className="flex flex-col gap-3">
                    <div className="rounded-t-lg bg-primary-50 px-6 py-4 text-h3 font-semibold text-primary-500">
                        Activity Stats
                    </div>
                    <div className="flex w-full flex-wrap gap-6 px-6">
                        <div className="flex w-full items-center justify-between">
                            <StudentSearchBox
                                searchInput={searchInput}
                                searchFilter={''}
                                onSearchChange={handleSearchChange}
                                onSearchEnter={() => {}}
                                onClearSearch={() => {}}
                            />
                            {/* {startDate && endDate && (
                                <div className="flex flex-wrap items-center gap-3">
                                    <MyButton
                                        buttonType="primary"
                                        scale="small"
                                        layoutVariant="default"
                                        className="h-8"
                                    >
                                        Filter
                                    </MyButton>
                                    <MyButton
                                        buttonType="secondary"
                                        scale="small"
                                        layoutVariant="default"
                                        className="h-8 border border-neutral-400 bg-neutral-200 hover:border-neutral-500 hover:bg-neutral-300 active:border-neutral-600 active:bg-neutral-400"
                                    >
                                        Reset
                                    </MyButton>
                                </div>
                            )} */}
                        </div>

                        {/* <div className="flex gap-6">
                            <MyInput
                                inputType="date"
                                inputPlaceholder="DD/MM/YY"
                                input={startDate}
                                onChangeFunction={handleStartDateChange}
                                required={true}
                                label="Start Date"
                                className="w-fit text-neutral-600"
                            />
                            <MyInput
                                inputType="date"
                                inputPlaceholder="DD/MM/YY"
                                input={endDate}
                                onChangeFunction={handleEndDateChange}
                                required={true}
                                label="End Date"
                                className="w-fit text-neutral-600"
                            />
                        </div> */}
                    </div>
                    <div className="no-scrollbar flex w-full flex-col gap-10 overflow-y-scroll">
                        <div className="flex w-full flex-col gap-6 p-6">
                            {tableData.content.length == 0 ? (
                                <p className="text-primary-500">No student activity found</p>
                            ) : (
                                <div>
                                    <MyTable<ActivityStatsColumnsType>
                                        data={tableData}
                                        columns={ActivityStatsColumns}
                                        isLoading={isLoading}
                                        error={error}
                                        columnWidths={ACTIVITY_STATS_COLUMN_WIDTHS}
                                        currentPage={page}
                                    />

                                    <div className="mt-6">
                                        <MyPagination
                                            currentPage={page}
                                            totalPages={tableData.total_pages}
                                            onPageChange={handlePageChange}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <ActivityLogDialog />
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
};
