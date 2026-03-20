import { useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Timeline, TimelineContent, TimelineItem, TimelineTime } from 'flowbite-react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { PlanningLog } from '../-types/types';
import { useDeletePlanningLog } from '../-services/updatePlanningLog';
import { getRelativeTimeLabel } from '../-utils/getRelativeTimeLabel';
import { usePlanningLogStore } from '../-stores/planning-log-store';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import TimelineLogCard from './TimelineLogCard';

interface PlanningLogsTimelineProps {
    data: PlanningLog[];
    totalPages: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    searchQuery: string;
    logType: 'planning' | 'diary_log';
    onView?: (log: PlanningLog) => void; // Optional custom view handler
    onCreateClick?: (label: string) => void; // Optional custom create handler
}

export default function PlanningLogsTimeline({
    data,
    totalPages,
    currentPage,
    onPageChange,
    searchQuery,
    logType,
    onView,
    onCreateClick,
}: PlanningLogsTimelineProps) {
    const navigate = useNavigate();
    const deleteMutation = useDeletePlanningLog();
    const [showPastLogs, setShowPastLogs] = useState(false);
    const [accumulatedLogs, setAccumulatedLogs] = useState<PlanningLog[]>([]);
    const setSelectedLog = usePlanningLogStore((state) => state.setSelectedLog);

    // Accumulate logs when new data arrives
    useEffect(() => {
        if (currentPage === 0) {
            // Reset accumulated logs when on first page (e.g., after filter change)
            setAccumulatedLogs(data);
        } else {
            // Append new logs to existing ones
            setAccumulatedLogs((prev) => {
                // Avoid duplicates by checking IDs
                const existingIds = new Set(prev.map((log) => log.id));
                const newLogs = data.filter((log) => !existingIds.has(log.id));
                return [...prev, ...newLogs];
            });
        }
    }, [data, currentPage]);

    const handleView = (log: PlanningLog) => {
        if (onView) {
            // Use custom view handler if provided
            onView(log);
        } else {
            // Default navigation behavior
            setSelectedLog(log);
            if (logType === 'planning') {
                navigate({
                    to: '/planning/planning/$logId',
                    params: { logId: log.id },
                });
            } else {
                navigate({
                    to: '/planning/activity-logs/$logId',
                    params: { logId: log.id },
                });
            }
        }
    };

    const handleDelete = async (log: PlanningLog) => {
        if (confirm('Are you sure you want to delete this planning log?')) {
            try {
                await deleteMutation.mutateAsync(log.id);
                toast.success('Planning log deleted successfully');
            } catch (error) {
                console.error('Failed to delete planning log:', error);
                toast.error('Failed to delete planning log');
            }
        }
    };

    // Highlight search text in results
    const highlightText = (text: string, highlight: string) => {
        if (!highlight.trim()) {
            return text;
        }
        const regex = new RegExp(`(${highlight})`, 'gi');
        const parts = text.split(regex);
        return (
            <span>
                {parts.map((part, i) =>
                    regex.test(part) ? (
                        <span key={i} className="bg-yellow-200 dark:text-black">
                            {part}
                        </span>
                    ) : (
                        part
                    )
                )}
            </span>
        );
    };

    // Reverse the data array to show in opposite order
    const reversedData = [...accumulatedLogs];

    // Separate past logs from current/future logs
    const pastLogs = reversedData.filter((log) => {
        const label = getRelativeTimeLabel(log.interval_type, log.interval_type_id);
        return label.toLowerCase().startsWith('past');
    });

    const currentAndFutureLogs = reversedData.filter((log) => {
        const label = getRelativeTimeLabel(log.interval_type, log.interval_type_id);
        return !label.toLowerCase().startsWith('past');
    });

    // Determine which logs to display
    const logsToDisplay = showPastLogs ? reversedData : currentAndFutureLogs;

    // Group logs by their relative time label
    const groupedLogs = logsToDisplay.reduce(
        (acc, log) => {
            const label = getRelativeTimeLabel(log.interval_type, log.interval_type_id);
            if (!acc[label]) {
                acc[label] = [];
            }
            acc[label]?.push(log);
            return acc;
        },
        {} as Record<string, PlanningLog[]>
    );

    // Define the order of labels for proper sorting
    // Today first, then Tomorrow, then future items, then past items
    const labelOrder = [
        'Today',
        'Tomorrow',
        'This week',
        'Next week',
        'This month',
        'Next month',
        'This quarter',
        'Next quarter',
        'Later',
        'Past days',
        'Past week',
        'Past month',
        'Past quarter',
    ];

    // Sort the grouped logs by label order
    const sortedGroupedLogs = Object.entries(groupedLogs).sort(([labelA], [labelB]) => {
        const indexA = labelOrder.indexOf(labelA);
        const indexB = labelOrder.indexOf(labelB);
        // If label not in order array, put it at the end
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    return (
        <div className="space-y-4">
            {accumulatedLogs.length === 0 ? (
                <div className="py-8 text-center">
                    <p className="text-muted-foreground">No results found.</p>
                </div>
            ) : (
                <>
                    {/* View Past button at top - only show if there are past logs and they're hidden */}
                    {!showPastLogs && pastLogs.length > 0 && (
                        <div className="flex justify-center pb-2">
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => setShowPastLogs(true)}
                                className="w-full max-w-fit"
                            >
                                <ChevronUp className="mr-2 size-4" />
                                View Past ({pastLogs.length})
                            </MyButton>
                        </div>
                    )}

                    <Timeline>
                        {sortedGroupedLogs.map(([label, logs]) => (
                            <TimelineItem key={label}>
                                {/*   <TimelinePoint /> */}
                                <TimelineContent>
                                    <TimelineTime className="text-black">{label}</TimelineTime>
                                    <div className="space-y-4">
                                        {logs.map((log) => (
                                            <TimelineLogCard
                                                key={log.id}
                                                log={log}
                                                logType={logType}
                                                searchQuery={searchQuery}
                                                onView={handleView}
                                                onDelete={handleDelete}
                                                highlightText={highlightText}
                                            />
                                        ))}

                                        {/* Add Log button for this timeline group */}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                if (onCreateClick) {
                                                    // Use custom create handler if provided
                                                    onCreateClick(label);
                                                } else {
                                                    // Default navigation behavior
                                                    const createPath =
                                                        logType === 'planning'
                                                            ? '/planning/planning/create'
                                                            : '/planning/activity-logs/create';
                                                    navigate({ to: createPath });
                                                }
                                            }}
                                            className="w-full"
                                        >
                                            + Add{' '}
                                            {logType === 'planning' ? 'Planning' : 'Activity Log'}{' '}
                                            for {label}
                                        </Button>
                                    </div>
                                </TimelineContent>
                            </TimelineItem>
                        ))}
                    </Timeline>

                    {/* View More button at bottom - only show if there are more pages */}
                    {currentPage < totalPages - 1 && (
                        <div className="flex justify-center pt-2">
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => onPageChange(currentPage + 1)}
                                className="w-full max-w-fit"
                            >
                                <ChevronDown className="mr-2 size-4" />
                                View More
                            </MyButton>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
