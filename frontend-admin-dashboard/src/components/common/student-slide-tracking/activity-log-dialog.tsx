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
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    activityLogColumns,
    activityResponseTypeColumns,
} from '@/components/design-system/utils/constants/table-column-data';
import { useActivityStatsStore } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/activity-stats-store';
import { useContentStore } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getUserVideoSlideActivityLogs,
    getUserDocActivityLogs,
    getQuestionSlideActivityLogs,
    getAssignmentSlideActivityLogs,
    getUserVideoResponseSlideActivityLogs,
    fetchAssignmentSlideLogs,
    gradeAssignmentSubmission,
} from '@/services/study-library/slide-operations/user-slide-activity-logs';
import { ActivityContent } from '@/types/study-library/user-slide-activity-response-type';
import { StudentTable } from '@/types/student-table-types';
import { SlideWithStatusType } from '@/routes/manage-students/students-list/-types/student-slides-progress-type';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { convertToLocalDateTime, extractDateTime } from '@/constants/helper';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { getPublicUrl } from '@/services/upload_file';
import { ColumnDef } from '@tanstack/react-table';
import { DownloadSimple, Eye, File, FilePdf, User, Spinner } from '@phosphor-icons/react';
import SimplePDFViewer from '@/components/common/simple-pdf-viewer';
import { fetchSlideActivityStats } from '@/services/study-library/slide-operations/slide-activity-stats';
import { UserActivity } from '@/types/study-library/activity-stats-response-type';
import { useRouter } from '@tanstack/react-router';

interface AssignmentFileInfo {
    fileId: string;
    url: string;
    isPdf: boolean;
}

interface AssignmentRowData {
    uploadDate: string;
    uploadTime: string;
    files: AssignmentFileInfo[];
    rawFileIds: string;
    trackedId: string;
    marks: number | null;
    feedback: string | null;
    checkedFileId: string | null;
}

const FileCell = ({ files }: { files: AssignmentFileInfo[] }) => {
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

    if (!files || files.length === 0) {
        return <span className="text-neutral-400">No files</span>;
    }

    return (
        <>
            <div className="flex flex-wrap gap-2">
                {files.map((file, idx) => (
                    <div
                        key={file.fileId}
                        className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1"
                    >
                        {file.isPdf ? (
                            <FilePdf size={16} className="shrink-0 text-red-500" />
                        ) : (
                            <File size={16} className="shrink-0 text-primary-500" />
                        )}
                        <span className="max-w-[120px] truncate text-xs text-neutral-700">
                            File {idx + 1}
                        </span>
                        {file.isPdf && file.url && (
                            <button
                                onClick={() => setPdfPreviewUrl(file.url)}
                                className="rounded p-0.5 hover:bg-primary-100"
                                title="Preview PDF"
                            >
                                <Eye size={14} className="text-primary-500" />
                            </button>
                        )}
                        {file.url && (
                            <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded p-0.5 hover:bg-primary-100"
                                title="Download file"
                            >
                                <DownloadSimple size={14} className="text-primary-500" />
                            </a>
                        )}
                    </div>
                ))}
            </div>

            {/* PDF Preview Dialog */}
            <Dialog open={!!pdfPreviewUrl} onOpenChange={() => setPdfPreviewUrl(null)}>
                <DialogContent className="flex h-[85vh] w-[80vw] max-w-[80vw] flex-col gap-0 p-0">
                    <div className="flex items-center justify-between rounded-t-lg bg-primary-50 px-4 py-3">
                        <h2 className="font-semibold text-primary-500">PDF Preview</h2>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        {pdfPreviewUrl && <SimplePDFViewer pdfUrl={pdfPreviewUrl} />}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

const GradeCell = ({ row, onGradeSaved }: { row: AssignmentRowData; onGradeSaved: () => void }) => {
    const [marks, setMarks] = useState<string>(row.marks != null ? String(row.marks) : '');
    const [feedback, setFeedback] = useState<string>(row.feedback || '');
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        if (!row.trackedId || marks === '') return;
        setIsSaving(true);
        try {
            await gradeAssignmentSubmission({
                tracked_id: row.trackedId,
                marks: Number(marks),
                feedback: feedback || undefined,
            });
            setSaved(true);
            onGradeSaved();
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Failed to grade:', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                    placeholder="Marks"
                    className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm focus:border-primary-400 focus:outline-none"
                    min={0}
                />
                <input
                    type="text"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Feedback (optional)"
                    className="w-36 rounded border border-neutral-300 px-2 py-1 text-sm focus:border-primary-400 focus:outline-none"
                />
                <button
                    onClick={handleSave}
                    disabled={isSaving || marks === ''}
                    className="rounded bg-primary-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSaving ? '...' : saved ? 'Saved' : 'Save'}
                </button>
            </div>
        </div>
    );
};

const assignmentColumnsWithPreview: ColumnDef<AssignmentRowData>[] = [
    {
        accessorKey: 'uploadDate',
        header: 'Upload Date',
    },
    {
        accessorKey: 'uploadTime',
        header: 'Upload Time',
    },
    {
        accessorKey: 'files',
        header: 'Submissions',
        cell: ({ row }) => <FileCell files={row.original.files} />,
    },
];

export const ActivityLogDialog = ({
    selectedUser,
    slideData,
}: {
    selectedUser?: StudentTable | null;
    slideData?: SlideWithStatusType;
}) => {
    const [selectedTab, setSelectedTab] = useState('insights');
    const { isOpen, closeDialog, selectedUserId, selectedUserName } = useActivityStatsStore();
    const { activeItem } = useContentStore();
    const router = useRouter();
    const { slideId: routeSlideId } = router.state.location.search as { slideId?: string };

    const queryClient = useQueryClient();
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
        if (activeItem?.source_type === 'VIDEO') {
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
                questionName: item.question_slides[0]?.response_json
                    ? JSON.parse(item.question_slides[0]?.response_json || '')?.questionName
                    : '',
                response: item.question_slides[0]?.response_json
                    ? JSON.parse(item.question_slides[0]?.response_json || '')
                          ?.selectedOptions?.map(
                              (option: { id: string; name: string }) => option.name
                          )
                          .join(',')
                    : '',
                responseStatus: item.question_slides[0]?.response_status,
            }));
        }

        if (activeItem?.source_type === 'ASSIGNMENT') {
            transformedContent = activityLogs.content
                .filter((item: ActivityContent) => item.assignment_slides?.length > 0)
                .map((item: ActivityContent) => ({
                    uploadDate: extractDateTime(
                        convertToLocalDateTime(item.assignment_slides[0]?.date_submitted || '')
                    ).date,
                    uploadTime: extractDateTime(
                        convertToLocalDateTime(item.assignment_slides[0]?.date_submitted || '')
                    ).time,
                    files: [] as AssignmentFileInfo[],
                    rawFileIds: item.assignment_slides[0]?.comma_separated_file_ids || '',
                    trackedId: item.assignment_slides[0]?.id || '',
                    marks: item.assignment_slides[0]?.marks ?? null,
                    feedback: item.assignment_slides[0]?.feedback ?? null,
                    checkedFileId: item.assignment_slides[0]?.checked_file_id ?? null,
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
                questionName: item.video_slides_questions[0]?.response_json
                    ? JSON.parse(item.video_slides_questions[0]?.response_json || '')?.questionName
                    : '',
                response: item.video_slides_questions[0]?.response_json
                    ? JSON.parse(item.video_slides_questions[0]?.response_json || '')
                          ?.selectedOptions?.map(
                              (option: { id: string; name: string }) => option.name
                          )
                          .join(',')
                    : '',
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

    // Resolve file IDs to public URLs for assignment submissions
    const [resolvedAssignmentData, setResolvedAssignmentData] = useState<AssignmentRowData[]>([]);
    const [isResolvingFiles, setIsResolvingFiles] = useState(false);

    useEffect(() => {
        if (activeItem?.source_type !== 'ASSIGNMENT' || tableData.content.length === 0) {
            setResolvedAssignmentData([]);
            return;
        }

        let cancelled = false;
        const resolveFiles = async () => {
            setIsResolvingFiles(true);
            const resolved = await Promise.all(
                (tableData.content as AssignmentRowData[]).map(async (row) => {
                    if (!row.rawFileIds) return { ...row, files: [] };
                    const fileIds = row.rawFileIds.split(',').filter(Boolean);
                    const files = await Promise.all(
                        fileIds.map(async (fid) => {
                            const url = await getPublicUrl(fid.trim());
                            const isPdf =
                                url.toLowerCase().includes('.pdf') ||
                                url.toLowerCase().includes('application/pdf');
                            return { fileId: fid.trim(), url, isPdf };
                        })
                    );
                    return { ...row, files };
                })
            );
            if (!cancelled) {
                setResolvedAssignmentData(resolved);
                setIsResolvingFiles(false);
            }
        };

        resolveFiles();
        return () => {
            cancelled = true;
        };
    }, [tableData.content, activeItem?.source_type]);

    const [isDownloadingAll, setIsDownloadingAll] = useState(false);

    const handleDownloadAllSubmissions = useCallback(async () => {
        const slideId = selectedUser && slideData ? slideData.slide_id : activeItem?.id || routeSlideId || '';
        if (!slideId) return;

        setIsDownloadingAll(true);
        try {
            // Step 1: Fetch all users from activity stats (paginate through all)
            const allUsers: UserActivity[] = [];
            let currentPage = 0;
            let lastPage = false;
            while (!lastPage) {
                const statsPage = await fetchSlideActivityStats(slideId, currentPage, 50);
                allUsers.push(...statsPage.content);
                lastPage = statsPage.last;
                currentPage++;
            }

            // Step 2: For each user, fetch all assignment logs
            const csvRows = ['Student Name,User ID,Upload Date,Upload Time,File URL'];
            for (const user of allUsers) {
                let logPage = 0;
                let logLast = false;
                while (!logLast) {
                    const logs = await fetchAssignmentSlideLogs(user.userId, slideId, logPage, 50);
                    for (const item of logs.content as ActivityContent[]) {
                        if (!item.assignment_slides?.length) continue;
                        for (const submission of item.assignment_slides) {
                            if (!submission.comma_separated_file_ids) continue;
                            const dateInfo = extractDateTime(
                                convertToLocalDateTime(submission.date_submitted || '')
                            );
                            const fileIds = submission.comma_separated_file_ids.split(',').filter(Boolean);
                            for (const fid of fileIds) {
                                const fileUrl = await getPublicUrl(fid.trim());
                                csvRows.push(
                                    `"${user.fullName}","${user.userId}","${dateInfo.date}","${dateInfo.time}","${fileUrl}"`
                                );
                            }
                        }
                    }
                    logLast = logs.last;
                    logPage++;
                }
            }

            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'all_assignment_submissions.csv';
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download all submissions:', err);
        } finally {
            setIsDownloadingAll(false);
        }
    }, [selectedUser, slideData, activeItem, routeSlideId]);

    return (
        <>
            <Dialog open={isOpen} onOpenChange={closeDialog}>
                <DialogContent
                    className="w-[700px] max-w-[95vw] p-0"
                >
                    <div className="rounded-t-lg bg-primary-50 px-4 py-3">
                        <h1 className="font-semibold text-primary-500">Activity Log</h1>
                        {(selectedUserName || selectedUser?.full_name) && (
                            <div className="mt-1 flex items-center gap-1.5 text-sm text-neutral-600">
                                <User size={14} className="text-neutral-500" />
                                <span>{selectedUserName || selectedUser?.full_name}</span>
                            </div>
                        )}
                    </div>
                    {isLoading || isVideoResponseLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <DashboardLoader />
                        </div>
                    ) : tableData.content.length == 0 ? (
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
                                                    totalPages={tableDataVideoResponse.total_pages}
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
                                        data={tableData}
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
                                    {isResolvingFiles ? (
                                        <div className="flex items-center justify-center p-4">
                                            <DashboardLoader />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-3 flex justify-end">
                                                <button
                                                    onClick={handleDownloadAllSubmissions}
                                                    disabled={isDownloadingAll}
                                                    className="flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {isDownloadingAll ? (
                                                        <Spinner size={14} className="animate-spin" />
                                                    ) : (
                                                        <DownloadSimple size={14} />
                                                    )}
                                                    {isDownloadingAll ? 'Downloading...' : 'Download All Users\' Submissions'}
                                                </button>
                                            </div>
                                            <MyTable
                                                data={{
                                                    ...tableData,
                                                    content: resolvedAssignmentData,
                                                }}
                                                columns={[
                                                    ...assignmentColumnsWithPreview,
                                                    {
                                                        id: 'grade',
                                                        header: 'Grade',
                                                        cell: ({ row }) => (
                                                            <GradeCell
                                                                row={row.original}
                                                                onGradeSaved={() => {
                                                                    queryClient.invalidateQueries({
                                                                        queryKey: ['GET_ASSIGNMENT_SLIDE_ACTIVITY_LOGS'],
                                                                    });
                                                                }}
                                                            />
                                                        ),
                                                    },
                                                ]}
                                                isLoading={isLoading}
                                                error={error}
                                                columnWidths={ACTIVITY_RESPONSE_ASSIGNMENT_COLUMN_WIDTHS}
                                                currentPage={page}
                                            />
                                        </>
                                    )}
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
