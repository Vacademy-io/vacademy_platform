import { format } from 'date-fns';
import type { PlanningLog } from '../-types/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Trash2 } from 'lucide-react';

interface SimplePlanningTableProps {
    data: PlanningLog[];
    onView: (log: PlanningLog) => void;
    onDelete: (log: PlanningLog) => void;
    isLoading?: boolean;
}

export default function SimplePlanningTable({
    data,
    onView,
    onDelete,
    isLoading,
}: SimplePlanningTableProps) {
    const formatDate = (dateString: string) => {
        try {
            return format(new Date(dateString), 'MMM dd, yyyy');
        } catch {
            return dateString;
        }
    };

    if (isLoading) {
        return (
            <div className="py-8 text-center">
                <p className="text-muted-foreground">Loading...</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="py-8 text-center">
                <p className="text-muted-foreground">No logs found</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((log) => (
                        <TableRow
                            key={log.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => onView(log)}
                        >
                            <TableCell className="font-medium">{log.title}</TableCell>
                            <TableCell>{log.created_by}</TableCell>
                            <TableCell>{formatDate(log.created_at)}</TableCell>
                            <TableCell className="text-right">
                                <div
                                    className="flex justify-end gap-2"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => onView(log)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => onDelete(log)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
