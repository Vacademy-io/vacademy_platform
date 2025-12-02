import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import type { PlanningLog } from "../-types/types";
import {
  formatIntervalType,
  formatIntervalTypeId,
} from "../-utils/intervalTypeIdFormatter";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PlanningLogsTableProps {
  data: PlanningLog[];
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onViewLog: (log: PlanningLog) => void;
}

export default function PlanningLogsTable({
  data,
  totalPages,
  currentPage,
  onPageChange,
  onViewLog,
}: PlanningLogsTableProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          No planning or activity logs shared with you yet
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your teachers will share planning and activity logs here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Interval</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.title}</TableCell>
                <TableCell>
                  {log.log_type === "planning" ? (
                    <Badge variant="default">Planning</Badge>
                  ) : (
                    <Badge variant="secondary">Activity</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {formatIntervalType(log.interval_type)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatIntervalTypeId(log.interval_type_id)}
                </TableCell>
                <TableCell>{log.created_by}</TableCell>
                <TableCell>
                  {new Date(log.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewLog(log)}
                  >
                    <Eye className="mr-2 size-4" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => currentPage > 0 && onPageChange(currentPage - 1)}
                className={
                  currentPage === 0
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  onClick={() => onPageChange(i)}
                  isActive={currentPage === i}
                  className="cursor-pointer"
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  currentPage < totalPages - 1 && onPageChange(currentPage + 1)
                }
                className={
                  currentPage === totalPages - 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
