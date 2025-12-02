import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Clock } from "lucide-react";
import type { PlanningLog } from "../-types/types";
import {
  formatIntervalType,
  formatIntervalTypeId,
} from "../-utils/intervalTypeIdFormatter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { unwrapContentFromHTML } from "../-utils/templateLoader";
import ReadOnlyQuillViewer from "@/components/quill/ReadOnlyQuillViewer";

interface ViewPlanningDialogProps {
  log: PlanningLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ViewPlanningDialog({
  log,
  open,
  onOpenChange,
}: ViewPlanningDialogProps) {
  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="ml-2">{log.title}</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-4">
            {/* Metadata Section */}
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="size-4 text-muted-foreground" />
                <span className="font-medium">Interval:</span>
                <Badge variant="outline">
                  {formatIntervalType(log.interval_type)}
                </Badge>
                <span className="font-semibold">
                  {formatIntervalTypeId(log.interval_type_id)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <User className="size-4 text-muted-foreground" />
                <span className="font-medium">Created by:</span>
                <span>{log.created_by}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-muted-foreground" />
                <span className="font-medium">Created at:</span>
                <span>
                  {new Date(log.created_at).toLocaleString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                  })}
                </span>
              </div>
            </div>

            {/* Description */}
            {log.description && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {log.description}
                </p>
              </div>
            )}

            {/* Content */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Content</h4>
              <ReadOnlyQuillViewer
                value={unwrapContentFromHTML(log.content_html)}
                minHeight={300}
              />
            </div>

            {/* Attachments */}
            {log.comma_separated_file_ids && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Attachments</h4>
                <div className="text-sm text-muted-foreground">
                  {log.comma_separated_file_ids.split(",").length} file(s)
                  attached
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
