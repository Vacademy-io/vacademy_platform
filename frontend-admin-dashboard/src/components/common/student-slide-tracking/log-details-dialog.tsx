import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { usePaginationState } from '@/hooks/pagination';
import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useContentStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { ColumnWidthConfig } from '@/components/design-system/utils/constants/table-layout';

interface VideoLogType {
    id: string;
    startTime: string;
    endTime: string;
}

interface DocumentLogType {
    id: string;
    page: number;
    timeSpent: string;
}

const formatMillisToTime = (millis: number): string => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const VIDEO_LOG_COLUMN_WIDTHS: ColumnWidthConfig = {
    startTime: 'min-w-[100px]',
    endTime: 'min-w-[100px]',
};

const DOC_LOG_COLUMN_WIDTHS: ColumnWidthConfig = {
    page: 'min-w-[50px]',
    timeSpent: 'min-w-[50px]',
};

interface VideoLog {
    id: string;
    start_time_in_millis: number;
    end_time_in_millis: number;
}

interface DocumentLog {
    id: string;
    start_time_in_millis: number;
    end_time_in_millis: number;
    page_number: number;
}

interface LogData {
    videos?: VideoLog[];
    documents?: DocumentLog[];
}

interface LogDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    logData: LogData;
}

export const LogDetailsDialog = ({ isOpen, onClose, logData }: LogDetailsDialogProps) => {
    const { activeItem } = useContentStore();
    const isVideo =
        activeItem?.video_slide?.url != null || activeItem?.video_slide?.published_url != null;

    const { page, pageSize, handlePageChange } = usePaginationState({
        initialPage: 0,
        initialPageSize: 5,
    });

    const VideoTable = useMemo(() => {
        const columns: ColumnDef<VideoLogType>[] = [
            {
                accessorKey: 'startTime',
                header: 'Start Time',
            },
            {
                accessorKey: 'endTime',
                header: 'End Time',
            },
        ];

        const data = !logData?.videos
            ? []
            : logData.videos.map((item: VideoLog) => ({
                  id: item.id,
                  startTime: formatMillisToTime(item.start_time_in_millis),
                  endTime: formatMillisToTime(item.end_time_in_millis),
              }));

        return {
            columns,
            data: {
                content: data,
                total_pages: Math.ceil(data.length / pageSize),
                page_no: page,
                page_size: pageSize,
                total_elements: data.length,
                last: (page + 1) * pageSize >= data.length,
            },
        };
    }, [logData, page, pageSize]);

    const DocumentTable = useMemo(() => {
        const columns: ColumnDef<DocumentLogType>[] = [
            {
                accessorKey: 'page',
                header: 'Page',
            },
            {
                accessorKey: 'timeSpent',
                header: 'Time Spent',
            },
        ];

        const data = !logData?.documents
            ? []
            : logData.documents.map((item: DocumentLog) => ({
                  id: item.id,
                  page: item.page_number,
                  timeSpent: formatMillisToTime(
                      item.end_time_in_millis - item.start_time_in_millis
                  ),
              }));

        return {
            columns,
            data: {
                content: data,
                total_pages: Math.ceil(data.length / pageSize),
                page_no: page,
                page_size: pageSize,
                total_elements: data.length,
                last: (page + 1) * pageSize >= data.length,
            },
        };
    }, [logData, page, pageSize]);
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[600px] max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="text-h3 font-semibold text-primary-500">
                        {isVideo ? 'Video Timestamps Logs' : 'Document Read Logs'}
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-6">
                    {isVideo ? (
                        VideoTable.data.content.length == 0 ? (
                            <p className="text-primary-500">No logs found!</p>
                        ) : (
                            <MyTable
                                data={VideoTable.data}
                                columns={VideoTable.columns}
                                isLoading={false}
                                error={null}
                                columnWidths={VIDEO_LOG_COLUMN_WIDTHS}
                                currentPage={page}
                            />
                        )
                    ) : DocumentTable.data.content.length == 0 ? (
                        <p className="text-primary-500">No logs found!</p>
                    ) : (
                        <MyTable
                            data={DocumentTable.data}
                            columns={DocumentTable.columns}
                            isLoading={false}
                            error={null}
                            columnWidths={DOC_LOG_COLUMN_WIDTHS}
                            currentPage={page}
                        />
                    )}

                    <div className="mt-6">
                        <MyPagination
                            currentPage={page}
                            totalPages={
                                isVideo
                                    ? VideoTable.data.total_pages
                                    : DocumentTable.data.total_pages
                            }
                            onPageChange={handlePageChange}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
