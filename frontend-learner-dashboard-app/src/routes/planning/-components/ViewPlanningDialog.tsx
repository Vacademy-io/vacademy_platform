import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Clock, FileText, ExternalLink } from "lucide-react";
import type { PlanningLog } from "../-types/types";
import {
  formatIntervalType,
  formatIntervalTypeId,
} from "../-utils/intervalTypeIdFormatter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { unwrapContentFromHTML } from "../-utils/templateLoader";
import ReadOnlyQuillViewer from "@/components/quill/ReadOnlyQuillViewer";
import { getPublicUrl } from "@/services/upload_file";
import { useState } from "react";

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
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

  if (!log) return null;

  const fileIds = log.comma_separated_file_ids
    ? log.comma_separated_file_ids
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

  const handleViewFile = async (fileId: string) => {
    try {
      setLoadingFileId(fileId);
      const url = await getPublicUrl(fileId);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("Error getting file URL:", error);
    } finally {
      setLoadingFileId(null);
    }
  };

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
            {fileIds.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">
                  Attachments ({fileIds.length})
                </h4>
                <div className="space-y-2">
                  {fileIds.map((fileId, index) => (
                    <div
                      key={fileId}
                      className="flex items-center justify-between rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="size-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            Attachment {index + 1}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewFile(fileId)}
                          disabled={loadingFileId === fileId}
                        >
                          {loadingFileId === fileId ? (
                            <span className="animate-spin">⏳</span>
                          ) : (
                            <ExternalLink className="size-4" />
                          )}
                          <span className="ml-2">View</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
