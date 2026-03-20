import { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Eye, Edit, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useListPlanningLogs } from '../-services/listPlanningLogs';
import { useDeletePlanningLog } from '../-services/updatePlanningLog';
import type { LogType, PlanningLog, PlanningLogFilters } from '../-types/types';
import { getUserId } from '@/utils/userDetails';
import { format } from 'date-fns';
import { formatIntervalTypeId } from '../-utils/intervalTypeIdFormatter';
import { usePlanningLogStore } from '../-stores/planning-log-store';
import { toast } from 'sonner';

interface PlanningLogsTableProps {
    data: PlanningLog[];
    totalPages: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    searchQuery: string;
    logType: LogType;
}

export default function PlanningLogsTable({
    data,
    totalPages,
    currentPage,
    onPageChange,
    searchQuery,
    logType,
}: PlanningLogsTableProps) {
    const navigate = useNavigate();
    const deleteMutation = useDeletePlanningLog();
    const currentUserId = getUserId();
    const setSelectedLog = usePlanningLogStore((state) => state.setSelectedLog);

    const handleView = (log: PlanningLog) => {
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

    const formatDate = (dateString: string) => {
        try {
            return format(new Date(dateString), 'MMM dd, yyyy');
        } catch {
            return dateString;
        }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Interval</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    No results found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((log) => (
                                <TableRow
                                    key={log.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleView(log)}
                                >
                                    <TableCell className="font-medium">
                                        {highlightText(log.title, searchQuery)}
                                    </TableCell>

                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-xs capitalize text-muted-foreground">
                                                {log.interval_type}
                                            </span>
                                            <span>
                                                {formatIntervalTypeId(log.interval_type_id)}
                                            </span>
                                        </div>
                                    </TableCell>

                                    <TableCell>{log.created_by}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                log.status === 'ACTIVE' ? 'default' : 'secondary'
                                            }
                                        >
                                            {log.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatDate(log.created_at)}</TableCell>
                                    <TableCell className="text-right">
                                        <div
                                            className="flex justify-end"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() => handleView(log)}
                                                    >
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        View
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleDelete(log)}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 0}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <div className="text-sm font-medium">
                        Page {currentPage + 1} of {totalPages}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages - 1}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
