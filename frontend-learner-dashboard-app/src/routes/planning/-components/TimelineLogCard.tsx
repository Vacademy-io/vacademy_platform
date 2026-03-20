import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import type { PlanningLog } from "../-types/types";
import {
  formatIntervalType,
  formatIntervalTypeId,
} from "../-utils/intervalTypeIdFormatter";

interface TimelineLogCardProps {
  log: PlanningLog;
  onView: (log: PlanningLog) => void;
  highlightText?: (text: string, highlight: string) => React.ReactNode;
  searchQuery?: string;
}

export default function TimelineLogCard({
  log,
  onView,
  highlightText,
  searchQuery = "",
}: TimelineLogCardProps) {
  const displayText = (text: string) => {
    if (highlightText && searchQuery) {
      return highlightText(text, searchQuery);
    }
    return text;
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="space-y-3">
        {/* Primary: Interval Type and Period */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 text-sm font-semibold">
            {formatIntervalType(log.interval_type)}
          </Badge>
          <span className="text-base font-bold text-foreground">
            {formatIntervalTypeId(log.interval_type_id)}
          </span>
        </div>

        {/* Title */}
        <div className="text-base font-medium text-foreground">
          {displayText(log.title)}
        </div>

        {/* Description Preview */}
        {log.description && (
          <div className="line-clamp-2 text-sm text-muted-foreground">
            {displayText(log.description)}
          </div>
        )}

        {/* Meta information */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>By: {log.created_by}</span>
          <span>
            {new Date(log.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Actions - ONLY VIEW BUTTON FOR LEARNERS */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onView(log)}>
            <Eye className="mr-2 size-4" />
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}
