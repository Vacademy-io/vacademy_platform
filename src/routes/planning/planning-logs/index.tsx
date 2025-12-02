import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Table as TableIcon, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import PlanningFilters from "../-components/PlanningFilters";
import PlanningLogsTable from "../-components/PlanningLogsTable";
import PlanningLogsTimeline from "../-components/PlanningLogsTimeline";
import ViewPlanningDialog from "../-components/ViewPlanningDialog";
import { useListPlanningLogs } from "../-services/listPlanningLogs";
import type {
  ListPlanningLogsRequest,
  PlanningLog,
  ViewMode,
} from "../-types/types";

export const Route = createFileRoute("/planning/planning-logs/")({
  component: PlanningLogsPage,
});

function PlanningLogsPage() {
  const [pageNo, setPageNo] = useState(0);
  const [pageSize] = useState(10);
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [selectedLog, setSelectedLog] = useState<PlanningLog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState<ListPlanningLogsRequest>({
    statuses: ["ACTIVE"],
    log_types: ["planning"],
  });

  const { setNavHeading } = useNavHeadingStore();

  // Set navigation heading
  useEffect(() => {
    setNavHeading("Planning Logs");
  }, [setNavHeading]);

  const { data, isLoading, error } = useListPlanningLogs({
    pageNo,
    pageSize,
    filters,
  });

  const handleFilterChange = (newFilters: ListPlanningLogsRequest) => {
    setFilters({
      ...newFilters,
      statuses: ["ACTIVE"],
      log_types: ["planning"],
    });
    setPageNo(0);
  };

  const handlePageChange = (newPage: number) => {
    setPageNo(newPage);
  };

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "table" ? "timeline" : "table"));
  };

  const handleViewLog = (log: PlanningLog) => {
    setSelectedLog(log);
    setDialogOpen(true);
  };

  return (
    <LayoutContainer>
      <div className="container mx-auto space-y-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Planning Logs</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleViewMode}
            className="flex items-center gap-2"
          >
            {viewMode === "table" ? (
              <>
                <List className="size-4" />
                Timeline View
              </>
            ) : (
              <>
                <TableIcon className="size-4" />
                Table View
              </>
            )}
          </Button>
        </div>

        {/* Filters */}
        <PlanningFilters filters={filters} onChange={handleFilterChange} />

        {/* Content */}
        {isLoading ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-destructive">Failed to load planning logs</p>
          </div>
        ) : viewMode === "table" ? (
          <PlanningLogsTable
            data={data?.content || []}
            totalPages={data?.totalPages || 0}
            currentPage={pageNo}
            onPageChange={handlePageChange}
            onViewLog={handleViewLog}
          />
        ) : (
          <PlanningLogsTimeline
            data={data?.content || []}
            totalPages={data?.totalPages || 0}
            currentPage={pageNo}
            onPageChange={handlePageChange}
            onViewLog={handleViewLog}
          />
        )}

        {/* View Dialog */}
        <ViewPlanningDialog
          log={selectedLog}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </div>
    </LayoutContainer>
  );
}
