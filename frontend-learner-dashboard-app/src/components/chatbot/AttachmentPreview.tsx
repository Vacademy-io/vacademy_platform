import React from "react";
import { Loader2 } from "lucide-react";

export interface PendingAttachment {
  type: string;
  url: string;
  name?: string;
  previewUrl?: string;
}

export interface AttachmentPreviewProps {
  /** Array of pending attachments to display as thumbnails. */
  attachments: PendingAttachment[];
  /**
   * Called when the user clicks the remove button on an attachment.
   * The consumer is responsible for revoking any object URLs.
   */
  onRemove: (index: number) => void;
  /** Whether an image upload is currently in progress. */
  isUploading?: boolean;
}

/**
 * Renders a row of pending-attachment thumbnails before the message is sent.
 *
 * Each thumbnail shows:
 * - The image preview (from previewUrl or url)
 * - A loading spinner overlay when the upload is still in progress (url is empty)
 * - A small delete button in the top-right corner
 */
export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachments,
  onRemove,
}) => {
  if (attachments.length === 0) return null;

  return (
    <div className="flex gap-1.5 w-full px-1 py-1">
      {attachments.map((att, i) => (
        <div
          key={i}
          className="relative size-10 rounded border overflow-hidden"
        >
          <img
            src={att.previewUrl || att.url}
            alt={att.name || "attachment"}
            className="size-full object-cover"
          />
          {/* Loading spinner overlay while upload is in progress */}
          {!att.url && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="h-3 w-3 text-white animate-spin" />
            </div>
          )}
          {/* Delete button */}
          <button
            className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center"
            onClick={() => onRemove(i)}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
};
