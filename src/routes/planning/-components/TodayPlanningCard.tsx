import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, BookOpen } from "lucide-react";
import type { PlanningLog } from "../-types/types";
import { formatDistanceToNow } from "date-fns";
import { ReadOnlyQuillViewer } from "@/components/quill/ReadOnlyQuillViewer";
import FileAttachments from "./FileAttachments";

interface TodayPlanningCardProps {
  log: PlanningLog;
  showBatchName?: string;
}

export default function TodayPlanningCard({
  log,
  showBatchName,
}: TodayPlanningCardProps) {
  const getIntervalTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      daily: "Daily",
      weekly: "This Week",
      monthly: "This Month",
      yearly_month: "This Month",
      yearly_quarter: "This Quarter",
    };
    return labels[type] || type;
  };

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <CardTitle className="text-xl">{log.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="gap-1">
                <Calendar className="size-3" />
                {getIntervalTypeLabel(log.interval_type)}
              </Badge>
              {showBatchName && (
                <Badge variant="outline" className="gap-1">
                  <BookOpen className="size-3" />
                  {showBatchName}
                </Badge>
              )}
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                Updated {formatDistanceToNow(new Date(log.updated_at))} ago
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {log.description && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">{log.description}</p>
          </div>
        )}

        <ReadOnlyQuillViewer
          value={log.content_html}
          className="border-0"
          minHeight={200}
        />

        {log.comma_separated_file_ids && (
          <FileAttachments
            fileIds={log.comma_separated_file_ids}
            showPreview={false}
          />
        )}

        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>Created by {log.created_by}</span>
          <span>{new Date(log.created_at).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
