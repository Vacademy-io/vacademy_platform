import { useState } from "react";
import { toast } from "sonner";
import { FileText, Eye, WarningCircle } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MyButton } from "@/components/design-system/button";
import { getFileDetail } from "@/services/upload_file";

export interface AttemptPaper {
  key: string;
  label: string;
  description: string;
  fileId?: string | null;
}

interface AttemptPapersCardProps {
  papers: AttemptPaper[];
}

/**
 * The scanned papers attached to an attempt — the learner's own answer sheet,
 * the checked copy, and a result report — each labelled for what it actually is.
 *
 * Visibility is driven ONLY by whether the file exists. It deliberately does not
 * check evaluation_type: an offline/hand-checked paper can carry a checked copy
 * on an otherwise objective assessment, and type-gating hid those from learners.
 */
export const AttemptPapersCard = ({ papers }: AttemptPapersCardProps) => {
  const available = papers.filter((paper) => !!paper.fileId);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  // Per-paper so one dead file id doesn't make the others look broken too.
  const [failedKeys, setFailedKeys] = useState<Record<string, string>>({});

  // Nothing attached to this attempt — render nothing rather than an empty card.
  if (available.length === 0) return null;

  const handleOpen = async (paper: AttemptPaper) => {
    if (!paper.fileId || openingKey) return;
    setOpeningKey(paper.key);
    setFailedKeys((prev) => {
      const next = { ...prev };
      delete next[paper.key];
      return next;
    });
    try {
      // Resolve the real name and MIME type so a JPEG scan opens as an image
      // rather than being assumed to be a PDF.
      const detail = await getFileDetail(paper.fileId);
      if (!detail?.url) {
        throw new Error("This file is no longer available.");
      }
      const opened = window.open(detail.url, "_blank", "noopener,noreferrer");
      if (!opened) {
        throw new Error(
          "Your browser blocked the pop-up. Allow pop-ups for this site and try again."
        );
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not open this file. Please try again.";
      setFailedKeys((prev) => ({ ...prev, [paper.key]: message }));
      toast.error(message);
    } finally {
      setOpeningKey(null);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <FileText className="size-5 text-primary-500" />
          Your papers
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {available.map((paper) => {
          const failure = failedKeys[paper.key];
          return (
            <div
              key={paper.key}
              className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 p-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">{paper.label}</p>
                <p className="text-xs text-slate-500">{paper.description}</p>
                {failure && (
                  <p className="mt-2 flex items-start gap-1 text-xs text-danger-600">
                    <WarningCircle className="mt-0.5 size-3 shrink-0" />
                    {failure}
                  </p>
                )}
              </div>
              <MyButton
                buttonType="secondary"
                scale="medium"
                layoutVariant="default"
                disable={openingKey !== null}
                onClick={() => void handleOpen(paper)}
                className="w-full"
              >
                <Eye className="size-4" />
                {openingKey === paper.key
                  ? "Opening..."
                  : failure
                    ? "Try again"
                    : "View"}
              </MyButton>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
