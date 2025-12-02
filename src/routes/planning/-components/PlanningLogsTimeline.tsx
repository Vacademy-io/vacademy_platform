import type { PlanningLog } from "../-types/types";
import { getRelativeTimeLabel } from "../-utils/getRelativeTimeLabel";
import TimelineLogCard from "./TimelineLogCard";
import { Button } from "@/components/ui/button";

interface PlanningLogsTimelineProps {
  data: PlanningLog[];
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onViewLog: (log: PlanningLog) => void;
  searchQuery?: string;
}

interface GroupedLogs {
  [key: string]: PlanningLog[];
}

export default function PlanningLogsTimeline({
  data,
  totalPages,
  currentPage,
  onPageChange,
  onViewLog,
  searchQuery = "",
}: PlanningLogsTimelineProps) {
  // Group logs by relative time
  const groupedLogs = data.reduce<GroupedLogs>((acc, log) => {
    const label = getRelativeTimeLabel(log.interval_type, log.interval_type_id);
    if (!acc[label]) {
      acc[label] = [];
    }
    acc[label].push(log);
    return acc;
  }, {});

  // Sort groups by priority (Today > Tomorrow > This Week > Past, etc.)
  const groupOrder = [
    "Today",
    "Tomorrow",
    "Next week",
    "Next month",
    "Next quarter",
    "Later",
    "Past days",
    "Past week",
    "Past month",
    "Past quarter",
  ];
  const sortedGroups = Object.keys(groupedLogs).sort((a, b) => {
    const aIndex = groupOrder.indexOf(a);
    const bIndex = groupOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

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
    <div className="space-y-6">
      {sortedGroups.map((groupLabel) => (
        <div key={groupLabel} className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            {groupLabel}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {groupedLogs[groupLabel]?.map((log) => (
              <TimelineLogCard
                key={log.id}
                log={log}
                onView={onViewLog}
                highlightText={highlightText}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Load More Button */}
      {currentPage < totalPages - 1 && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
