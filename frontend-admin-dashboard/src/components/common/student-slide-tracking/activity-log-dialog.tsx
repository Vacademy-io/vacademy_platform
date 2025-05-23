// activity-log-dialog.tsx
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import {
    ACTIVITY_LOG_COLUMN_WIDTHS,
    ACTIVITY_RESPONSE_ASSIGNMENT_COLUMN_WIDTHS,
    ACTIVITY_RESPONSE_COLUMN_WIDTHS,
} from '@/components/design-system/utils/constants/table-layout';
import { usePaginationState } from '@/hooks/pagination';
import { useMemo, useState } from 'react';
import {
    activityLogColumns,
    activityResponseAssignmentColumns,
    activityResponseTypeColumns,
} from '@/components/design-system/utils/constants/table-column-data';
import { useActivityStatsStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/activity-stats-store';
import { useContentStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { useQuery } from '@tanstack/react-query';
import {
    getUserVideoSlideActivityLogs,
    getUserDocActivityLogs,
    getQuestionSlideActivityLogs,
    getAssignmentSlideActivityLogs,
    getUserVideoResponseSlideActivityLogs,
} from '@/services/study-library/slide-operations/user-slide-activity-logs';
import { ActivityContent } from '@/types/study-library/user-slide-activity-response-type';
import { StudentTable } from '@/types/student-table-types';
import { SlideWithStatusType } from '@/routes/manage-students/students-list/-types/student-slides-progress-type';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { convertToLocalDateTime, extractDateTime } from '@/constants/helper';

export const ActivityLogDialog = ({
    selectedUser,
    slideData,
}: {
    selectedUser?: StudentTable | null;
    slideData?: SlideWithStatusType;
}) => {
    const [selectedTab, setSelectedTab] = useState('insights');
    const { isOpen, closeDialog, selectedUserId } = useActivityStatsStore();
    const { activeItem } = useContentStore();

    const { page, pageSize, handlePageChange } = usePaginationState({
        initialPage: 0,
        initialPageSize: 5,
    });

    const queryConfig = useMemo(() => {
        const userId = selectedUser && slideData ? selectedUser.user_id : selectedUserId || '';
        const slideId = selectedUser && slideData ? slideData.slide_id : activeItem?.id || '';

        if (activeItem?.source_type === 'QUESTION') {
            return getQuestionSlideActivityLogs({
                userId,
                slideId,
                pageNo: page,
                pageSize: pageSize,
            });
        }
        if (activeItem?.source_type === 'ASSIGNMENT') {
            return getAssignmentSlideActivityLogs({
                userId,
                slideId,
                pageNo: page,
                pageSize: pageSize,
            });
        }
        if (activeItem?.video_slide?.url != null) {
            return getUserVideoSlideActivityLogs({
                userId,
                slideId,
                pageNo: page,
                pageSize: pageSize,
            });
        } else {
            return getUserDocActivityLogs({
                userId,
                slideId,
                pageNo: page,
                pageSize: pageSize,
            });
        }
    }, [selectedUser, slideData, selectedUserId, activeItem, page, pageSize]);

    const queryConfigVideoResponse = useMemo(() => {
        const userId = selectedUser && slideData ? selectedUser.user_id : selectedUserId || '';
        const slideId = selectedUser && slideData ? slideData.slide_id : activeItem?.id || '';

        return getUserVideoResponseSlideActivityLogs({
            userId,
            slideId,
            pageNo: page,
            pageSize: pageSize,
        });
    }, [selectedUser, slideData, selectedUserId, activeItem, page, pageSize]);

    const { data: activityLogs, isLoading, error } = useQuery(queryConfig);
    const {
        data: activityLogsVideoResponse,
        isLoading: isVideoResponseLoading,
        error: isVideoResponseError,
    } = useQuery(queryConfigVideoResponse);

    const formatDateTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    const tableData = useMemo(() => {
        if (!activityLogs) {
            return {
                content: [],
                total_pages: 0,
                page_no: 0,
                page_size: pageSize,
                total_elements: 0,
                last: true,
            };
        }

        let transformedContent = activityLogs.content;

        if (activeItem?.source_type === 'VIDEO' || activeItem?.source_type === 'DOCUMENT') {
            transformedContent = activityLogs.content.map((item: ActivityContent) => ({
                activityDate: formatDateTime(item.start_time_in_millis).split(',')[0],
                startTime: formatDateTime(item.start_time_in_millis).split(',')[1],
                endTime: formatDateTime(item.end_time_in_millis).split(',')[1],
                duration: `${(
                    (item.end_time_in_millis - item.start_time_in_millis) /
                    1000 /
                    60
                ).toFixed(2)} mins`,
                lastPageRead: item.percentage_watched,
                videos: item.videos,
                documents: item.documents,
                concentrationScore: item.concentration_score?.concentration_score || 0,
            }));
        }
        if (activeItem?.source_type === 'QUESTION') {
            transformedContent = activityLogs.content.map((item: ActivityContent) => ({
                activityDate: formatDateTime(item.start_time_in_millis).split(',')[0],
                attemptNumber: item.question_slides[0]?.attempt_number,
                startTime: formatDateTime(item.start_time_in_millis).split(',')[1],
                endTime: formatDateTime(item.end_time_in_millis).split(',')[1],
                duration: `${(
                    (item.end_time_in_millis - item.start_time_in_millis) /
                    1000 /
                    60
                ).toFixed(2)} mins`,
                response: item.question_slides[0]?.response_json,
                responseStatus: item.question_slides[0]?.response_status,
            }));
        }

        if (activeItem?.source_type === 'ASSIGNMENT') {
            transformedContent = activityLogs.content.map((item: ActivityContent) => ({
                uploadDate: extractDateTime(
                    convertToLocalDateTime(item.assignment_slides[0]?.date_submitted || '')
                ).date,
                uploadTime: extractDateTime(
                    convertToLocalDateTime(item.assignment_slides[0]?.date_submitted || '')
                ).time,
                submissions: item.assignment_slides[0]?.comma_separated_file_ids,
            }));
        }

        return {
            content: transformedContent,
            total_pages: activityLogs.totalPages,
            page_no: page,
            page_size: pageSize,
            total_elements: activityLogs.totalElements,
            last: activityLogs.last,
        };
    }, [activityLogs, page, pageSize, selectedUser, slideData, activeItem]);

    const tableDataVideoResponse = useMemo(() => {
        if (!activityLogsVideoResponse) {
            return {
                content: [],
                total_pages: 0,
                page_no: 0,
                page_size: pageSize,
                total_elements: 0,
                last: true,
            };
        }

        const transformedContent = activityLogsVideoResponse.content.map(
            (item: ActivityContent) => ({
                activityDate: formatDateTime(item.start_time_in_millis).split(',')[0],
                startTime: formatDateTime(item.start_time_in_millis).split(',')[1],
                endTime: formatDateTime(item.end_time_in_millis).split(',')[1],
                duration: `${(
                    (item.end_time_in_millis - item.start_time_in_millis) /
                    1000 /
                    60
                ).toFixed(2)} mins`,
                response: item.video_slides_questions[0]?.response_json,
                responseStatus: item.video_slides_questions[0]?.response_status,
            })
        );

        return {
            content: transformedContent,
            total_pages: activityLogsVideoResponse.totalPages,
            page_no: page,
            page_size: pageSize,
            total_elements: activityLogsVideoResponse.totalElements,
            last: activityLogsVideoResponse.last,
        };
    }, [activityLogsVideoResponse, page, pageSize, selectedUser, slideData, activeItem]);

    return (
        <>
            <Dialog open={isOpen} onOpenChange={closeDialog}>
                <DialogContent
                    className={`${tableData.content.length == 0 ? 'w-1/2' : 'w-fit'} p-0`}
                >
                    <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                        Activity Log
                    </h1>
                    {tableData.content.length == 0 ? (
                        <p className="p-4 text-center text-primary-500">No activity found</p>
                    ) : (
                        <>
                            {activeItem?.source_type === 'VIDEO' && (
                                <Tabs
                                    className="p-4"
                                    value={selectedTab}
                                    onValueChange={setSelectedTab}
                                >
                                    <TabsList className="inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
                                        <TabsTrigger
                                            value="insights"
                                            className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                                                selectedTab === 'insights'
                                                    ? 'border-4px rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                                    : 'border-none bg-transparent'
                                            }`}
                                        >
                                            <span
                                                className={`${selectedTab === 'insights' ? 'text-primary-500' : ''}`}
                                            >
                                                View Insights
                                            </span>
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="responses"
                                            className={`inline-flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                                                selectedTab === 'responses'
                                                    ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                                    : 'border-none bg-transparent'
                                            }`}
                                        >
                                            <span
                                                className={`${selectedTab === 'responses' ? 'text-primary-500' : ''}`}
                                            >
                                                Responses
                                            </span>
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="insights">
                                        <div className="no-scrollbar mt-6 overflow-x-scroll">
                                            <MyTable
                                                data={tableData}
                                                columns={activityLogColumns}
                                                isLoading={isLoading}
                                                error={error}
                                                columnWidths={ACTIVITY_LOG_COLUMN_WIDTHS}
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
                                    </TabsContent>
                                    <TabsContent value="responses">
                                        <div className="no-scrollbar mt-6 overflow-x-scroll">
                                            <MyTable
                                                data={tableDataVideoResponse}
                                                columns={activityResponseTypeColumns}
                                                isLoading={isVideoResponseLoading}
                                                error={isVideoResponseError}
                                                columnWidths={ACTIVITY_RESPONSE_COLUMN_WIDTHS}
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
                                    </TabsContent>
                                </Tabs>
                            )}

                            {activeItem?.source_type === 'QUESTION' && (
                                <div className="no-scrollbar mt-6 overflow-x-scroll px-4">
                                    <MyTable
                                        data={{
                                            content: [],
                                            total_pages: 0,
                                            page_no: 0,
                                            page_size: pageSize,
                                            total_elements: 0,
                                            last: true,
                                        }}
                                        columns={activityResponseTypeColumns}
                                        isLoading={isLoading}
                                        error={error}
                                        columnWidths={ACTIVITY_RESPONSE_COLUMN_WIDTHS}
                                        currentPage={page}
                                    />
                                    <div className="my-6">
                                        <MyPagination
                                            currentPage={page}
                                            totalPages={tableData.total_pages}
                                            onPageChange={handlePageChange}
                                        />
                                    </div>
                                </div>
                            )}

                            {activeItem?.source_type === 'ASSIGNMENT' && (
                                <div className="no-scrollbar mt-6 overflow-x-scroll px-4">
                                    <MyTable
                                        data={{
                                            content: [],
                                            total_pages: 0,
                                            page_no: 0,
                                            page_size: pageSize,
                                            total_elements: 0,
                                            last: true,
                                        }}
                                        columns={activityResponseAssignmentColumns}
                                        isLoading={isLoading}
                                        error={error}
                                        columnWidths={ACTIVITY_RESPONSE_ASSIGNMENT_COLUMN_WIDTHS}
                                        currentPage={page}
                                    />
                                    <div className="my-6">
                                        <MyPagination
                                            currentPage={page}
                                            totalPages={tableData.total_pages}
                                            onPageChange={handlePageChange}
                                        />
                                    </div>
                                </div>
                            )}

                            {activeItem?.source_type === 'DOCUMENT' && (
                                <div className="no-scrollbar mt-6 overflow-x-scroll px-4">
                                    <MyTable
                                        data={tableData}
                                        columns={activityLogColumns}
                                        isLoading={isLoading}
                                        error={error}
                                        columnWidths={ACTIVITY_LOG_COLUMN_WIDTHS}
                                        currentPage={page}
                                    />
                                    <div className="my-6">
                                        <MyPagination
                                            currentPage={page}
                                            totalPages={tableData.total_pages}
                                            onPageChange={handlePageChange}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};
