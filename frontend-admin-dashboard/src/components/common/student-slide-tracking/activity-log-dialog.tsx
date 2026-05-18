// activity-log-dialog.tsx
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import {
    ACTIVITY_LOG_COLUMN_WIDTHS,
    ACTIVITY_RESPONSE_COLUMN_WIDTHS,
} from '@/components/design-system/utils/constants/table-layout';
import { usePaginationState } from '@/hooks/pagination';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    gradeAssignmentSubmission,
} from '@/services/study-library/slide-operations/user-slide-activity-logs';
import { ActivityContent } from '@/types/study-library/user-slide-activity-response-type';
import { StudentTable } from '@/types/student-table-types';
import { SlideWithStatusType } from '@/routes/manage-students/students-list/-types/student-slides-progress-type';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { convertToLocalDateTime, extractDateTime } from '@/constants/helper';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { getPublicUrl, UploadFileInS3 } from '@/services/upload_file';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { DownloadSimple, Eye, File, FilePdf, Spinner, UploadSimple, X as XIcon, ClipboardText, CheckCircle, Clock as ClockIcon } from '@phosphor-icons/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import SimplePDFViewer from '@/components/common/simple-pdf-viewer';
import { downloadAllAssignmentSubmissions } from '@/services/study-library/slide-operations/download-assignment-submissions';
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

const SubmissionCard = ({
    row,
    onGradeSaved,
}: {
    row: AssignmentRowData;
    onGradeSaved: () => void;
}) => {
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [marks, setMarks] = useState<string>(row.marks != null ? String(row.marks) : '');
    const [feedback, setFeedback] = useState<string>(row.feedback || '');
    const [checkedFileId, setCheckedFileId] = useState<string | null>(row.checkedFileId);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // marks=0 is set by default at student submission time, so the teacher has
    // only actually graded if any of: positive marks, feedback, or checked copy.
    const isGraded =
        (row.marks != null && row.marks > 0) || !!row.feedback || !!row.checkedFileId;

    const handleUploadCheckedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const token = getTokenFromCookie(TokenKey.accessToken);
            const userId = getTokenDecodedData(token)?.sub || '';
            const fileId = await UploadFileInS3(
                file,
                () => {},
                userId,
                'CHECKED_ASSIGNMENT',
                'TEACHER',
                true
            );
            if (fileId) setCheckedFileId(fileId);
        } catch (err) {
            console.error('Failed to upload checked file:', err);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleViewCheckedFile = async () => {
        if (!checkedFileId) return;
        const url = await getPublicUrl(checkedFileId);
        if (url) window.open(url, '_blank');
    };

    const handleSave = async () => {
        if (!row.trackedId || marks === '') return;
        setIsSaving(true);
        try {
            await gradeAssignmentSubmission({
                tracked_id: row.trackedId,
                marks: Number(marks),
                feedback: feedback || undefined,
                checked_file_id: checkedFileId || undefined,
            });
            setSavedFlash(true);
            onGradeSaved();
            setTimeout(() => setSavedFlash(false), 2000);
        } catch (err) {
            console.error('Failed to grade:', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                    {/* Left — Submission Info */}
                    <div className="flex flex-col gap-3 border-b border-neutral-200 p-5 lg:border-b-0 lg:border-r">
                        {/* Date + status */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-neutral-800">
                                    {row.uploadDate}
                                </span>
                                <span className="text-xs text-neutral-500">{row.uploadTime}</span>
                            </div>
                            {isGraded ? (
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                        {row.marks} marks
                                    </span>
                                    {row.checkedFileId && (
                                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                                            ✓ Checked
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                                    Pending Review
                                </span>
                            )}
                        </div>

                        {/* Submitted Files */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                                Submitted Files ({row.files.length})
                            </span>
                            {row.files.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 py-6 text-neutral-400">
                                    <File size={28} />
                                    <span className="text-xs">No files submitted</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {row.files.map((file, idx) => (
                                        <div
                                            key={file.fileId}
                                            className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2.5 transition-colors hover:border-neutral-300"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div
                                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                                                        file.isPdf ? 'bg-red-50' : 'bg-neutral-100'
                                                    }`}
                                                >
                                                    {file.isPdf ? (
                                                        <FilePdf size={18} className="text-red-500" />
                                                    ) : (
                                                        <File
                                                            size={18}
                                                            className="text-neutral-500"
                                                        />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-neutral-800">
                                                        File {idx + 1}
                                                    </p>
                                                    <p className="text-[11px] text-neutral-500">
                                                        {file.isPdf ? 'PDF Document' : 'Document'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                {file.isPdf && file.url && (
                                                    <button
                                                        onClick={() => setPdfPreviewUrl(file.url)}
                                                        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                                                        title="Preview"
                                                    >
                                                        <Eye size={13} className="inline" /> View
                                                    </button>
                                                )}
                                                {file.url && (
                                                    <a
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                                                        title="Download"
                                                    >
                                                        <DownloadSimple
                                                            size={13}
                                                            className="inline"
                                                        />{' '}
                                                        Download
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Saved feedback preview */}
                        {isGraded && row.feedback && (
                            <div className="rounded-md bg-neutral-50 px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                                    Saved Feedback
                                </p>
                                <p className="mt-0.5 text-xs text-neutral-700 line-clamp-3">
                                    {row.feedback}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right — Inline Grade Form */}
                    <div className="flex flex-col gap-3 bg-neutral-50/50 p-5">
                        <div className="flex items-center gap-2">
                            <ClipboardText size={14} className="text-emerald-600" weight="bold" />
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
                                {isGraded ? 'Edit Grade' : 'Grade Submission'}
                            </span>
                        </div>

                        {/* Marks */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-medium text-neutral-600">
                                Marks <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={marks}
                                onChange={(e) => setMarks(e.target.value)}
                                placeholder="Enter marks"
                                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                                min={0}
                            />
                        </div>

                        {/* Feedback */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-medium text-neutral-600">
                                Feedback{' '}
                                <span className="font-normal text-neutral-400">(optional)</span>
                            </label>
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Write feedback for the student..."
                                rows={2}
                                className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>

                        {/* Checked Copy */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-medium text-neutral-600">
                                Checked Answer Copy{' '}
                                <span className="font-normal text-neutral-400">(optional)</span>
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                onChange={handleUploadCheckedFile}
                                className="hidden"
                            />
                            {checkedFileId ? (
                                <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <FilePdf size={14} className="shrink-0 text-emerald-600" />
                                        <span className="truncate text-xs font-medium text-emerald-700">
                                            Checked copy uploaded
                                        </span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-0.5">
                                        <button
                                            onClick={handleViewCheckedFile}
                                            className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                                            title="View"
                                        >
                                            <Eye size={12} />
                                        </button>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="rounded p-1 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                            title="Replace"
                                        >
                                            {isUploading ? (
                                                <Spinner size={12} className="animate-spin" />
                                            ) : (
                                                <UploadSimple size={12} />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setCheckedFileId(null)}
                                            className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                                            title="Remove"
                                        >
                                            <XIcon size={12} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 bg-white px-2 py-2 text-xs font-medium text-neutral-600 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                                >
                                    {isUploading ? (
                                        <>
                                            <Spinner size={12} className="animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <UploadSimple size={12} />
                                            Upload Checked Copy
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Save */}
                        <button
                            onClick={handleSave}
                            disabled={isSaving || marks === ''}
                            className={`mt-1 w-full rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                savedFlash
                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                    : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                        >
                            {isSaving
                                ? 'Saving...'
                                : savedFlash
                                  ? '✓ Saved'
                                  : isGraded
                                    ? 'Update Grade'
                                    : 'Save Grade'}
                        </button>
                    </div>
                </div>
            </div>

            {/* PDF Preview */}
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
                .filter((item: ActivityContent) => item.source_type === 'ASSIGNMENT')
                .map((item: ActivityContent) => {
                    const submission = item.assignment_slides?.[0];
                    const dateTime = submission?.date_submitted
                        ? extractDateTime(convertToLocalDateTime(submission.date_submitted))
                        : {
                              date: formatDateTime(item.start_time_in_millis).split(',')[0],
                              time: formatDateTime(item.start_time_in_millis).split(',')[1],
                          };
                    return {
                        uploadDate: dateTime.date,
                        uploadTime: dateTime.time,
                        files: [] as AssignmentFileInfo[],
                        rawFileIds: submission?.comma_separated_file_ids || '',
                        trackedId: submission?.id || '',
                        marks: submission?.marks ?? null,
                        feedback: submission?.feedback ?? null,
                        checkedFileId: submission?.checked_file_id ?? null,
                    };
                });
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
            await downloadAllAssignmentSubmissions(slideId);
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
                    className="flex max-h-[90vh] w-[920px] max-w-[95vw] flex-col gap-0 overflow-hidden p-0"
                >
                    {/* Hero header with student avatar */}
                    {(() => {
                        const studentName = selectedUserName || selectedUser?.full_name || '';
                        const initials = studentName
                            .split(' ')
                            .map((n) => n[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join('')
                            .toUpperCase() || '?';
                        const isAssignment = activeItem?.source_type === 'ASSIGNMENT';
                        const total = resolvedAssignmentData.length;
                        const graded = resolvedAssignmentData.filter(
                            (r) =>
                                (r.marks != null && r.marks > 0) ||
                                !!r.feedback ||
                                !!r.checkedFileId
                        ).length;
                        const pending = total - graded;

                        return (
                            <div className="flex flex-col border-b border-neutral-200 bg-gradient-to-r from-primary-50 to-white">
                                <div className="flex items-center gap-3 px-6 py-5">
                                    <Avatar className="h-12 w-12 shadow-sm">
                                        <AvatarFallback className="bg-primary-500 text-base font-semibold text-white">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <p className="text-[11px] font-medium uppercase tracking-wide text-primary-500">
                                            Activity Log
                                        </p>
                                        <h1 className="truncate text-lg font-semibold text-neutral-900">
                                            {studentName || 'Student'}
                                        </h1>
                                    </div>
                                </div>
                                {isAssignment && total > 0 && (
                                    <div className="grid grid-cols-3 gap-px border-t border-neutral-200 bg-neutral-100">
                                        <div className="flex items-center gap-2.5 bg-white px-6 py-2.5">
                                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                                                <ClipboardText size={14} weight="bold" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                                    Submissions
                                                </p>
                                                <p className="text-sm font-semibold text-neutral-900">
                                                    {total}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2.5 bg-white px-6 py-2.5">
                                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                                                <CheckCircle size={14} weight="bold" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                                    Marked
                                                </p>
                                                <p className="text-sm font-semibold text-neutral-900">
                                                    {graded}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2.5 bg-white px-6 py-2.5">
                                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                                                <ClockIcon size={14} weight="bold" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                                    Unmarked
                                                </p>
                                                <p className="text-sm font-semibold text-neutral-900">
                                                    {pending}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                    {isLoading || isVideoResponseLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <DashboardLoader />
                        </div>
                    ) : tableData.content.length == 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-neutral-500">
                            <ClipboardText size={36} className="text-neutral-300" weight="duotone" />
                            <p className="text-sm font-medium">No activity yet</p>
                            <p className="text-xs">This student hasn't engaged with the slide</p>
                        </div>
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

                                            {tableData.total_pages > 1 && (
                                                <div className="mt-6">
                                                    <MyPagination
                                                        currentPage={page}
                                                        totalPages={tableData.total_pages}
                                                        onPageChange={handlePageChange}
                                                    />
                                                </div>
                                            )}
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
                                            {tableDataVideoResponse.total_pages > 1 && (
                                                <div className="mt-6">
                                                    <MyPagination
                                                        currentPage={page}
                                                        totalPages={tableDataVideoResponse.total_pages}
                                                        onPageChange={handlePageChange}
                                                    />
                                                </div>
                                            )}
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
                                    {tableData.total_pages > 1 && (
                                        <div className="my-6">
                                            <MyPagination
                                                currentPage={page}
                                                totalPages={tableData.total_pages}
                                                onPageChange={handlePageChange}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeItem?.source_type === 'ASSIGNMENT' && (
                                <div className="mt-6 px-4">
                                    {isResolvingFiles ? (
                                        <div className="flex items-center justify-center p-4">
                                            <DashboardLoader />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-4 flex justify-end">
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
                                            <div className="flex flex-col gap-3">
                                                {resolvedAssignmentData.map((row, idx) => (
                                                    <SubmissionCard
                                                        key={row.trackedId || idx}
                                                        row={row}
                                                        onGradeSaved={() => {
                                                            queryClient.invalidateQueries({
                                                                queryKey: ['GET_ASSIGNMENT_SLIDE_ACTIVITY_LOGS'],
                                                            });
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    {tableData.total_pages > 1 && (
                                        <div className="my-6">
                                            <MyPagination
                                                currentPage={page}
                                                totalPages={tableData.total_pages}
                                                onPageChange={handlePageChange}
                                            />
                                        </div>
                                    )}
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
                                    {tableData.total_pages > 1 && (
                                        <div className="my-6">
                                            <MyPagination
                                                currentPage={page}
                                                totalPages={tableData.total_pages}
                                                onPageChange={handlePageChange}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};
