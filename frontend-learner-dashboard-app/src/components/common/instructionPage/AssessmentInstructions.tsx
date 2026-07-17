import type { ReactNode } from "react";
import { useMemo } from "react";
import { formatDuration } from "@/constants/helper";
import { Assessment } from "@/types/assessment";
import {
  Clock,
  Eye,
  ArrowsLeftRight,
  ListChecks,
  Info,
  FilePdf,
  Paperclip,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import SimplePDFViewer from "@/components/common/simple-pdf-viewer";

interface AssessmentInstructionsProps {
  instructions: string;
  duration: number;
  preview: boolean;
  canSwitchSections: boolean;
  assessmentInfo: Assessment;
}

interface InstructionAttachment {
  url: string;
  fileName: string;
  isPdf: boolean;
}

const FILE_EXT_PATTERN =
  /\.(pdf|docx?|xlsx?|csv|pptx?|zip|rar|7z|tar|gz|jpg|jpeg|png|gif|svg|webp|mp4|mov|webm|mp3|wav|ogg)(\?|#|$)/i;

/**
 * The instruction rich-text can embed a question paper as a file-attachment
 * anchor (`<a data-attachment="true" href="…pdf">`). Rendered raw it shows up
 * as a bare link, so we pull those anchors out of the HTML, strip them so they
 * don't render twice, and surface PDFs as an inline viewer / other files as
 * download links. Mirrors `extractAndStripAttachments` in assignment-slide.tsx.
 */
const parseInstructions = (
  html: string
): { cleanHtml: string; attachments: InstructionAttachment[] } => {
  if (!html || typeof DOMParser === "undefined") {
    return { cleanHtml: html, attachments: [] };
  }
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const anchors = doc.querySelectorAll('a[data-attachment="true"], a[href]');
    const attachments: InstructionAttachment[] = [];
    const seen = new Set<string>();

    anchors.forEach((node) => {
      const anchor = node as HTMLAnchorElement;
      const href = anchor.getAttribute("href") || "";
      if (!href || href === "#") return;
      const name =
        anchor.getAttribute("name") || anchor.textContent?.trim() || "";
      const type = anchor.getAttribute("type") || "";
      const isAttachment = anchor.getAttribute("data-attachment") === "true";
      const isFileLink =
        FILE_EXT_PATTERN.test(href) || (!!name && FILE_EXT_PATTERN.test(name));
      if (!isAttachment && !isFileLink) return;

      if (!seen.has(href)) {
        seen.add(href);
        const isPdf =
          /\.pdf(\?|#|$)/i.test(href) ||
          /\.pdf$/i.test(name) ||
          type.toLowerCase().includes("pdf");
        attachments.push({
          url: href,
          fileName: name || href.split("/").pop() || "Attachment",
          isPdf,
        });
      }
      anchor.parentNode?.removeChild(anchor);
    });

    return { cleanHtml: doc.body?.innerHTML || "", attachments };
  } catch {
    return { cleanHtml: html, attachments: [] };
  }
};

const getAttemptInfo = (assessmentInfo: Assessment) => {
  // assessment_attempts is the globally configured max; created_attempts is how
  // many the user has already used. Show the next attempt number (used + 1) out
  // of the configured max so the learner sees "Attempt 1 of 5" before starting.
  const maxAttempts = assessmentInfo.assessment_attempts ?? 1;
  const usedAttempts = assessmentInfo.created_attempts ?? 0;
  return { used: usedAttempts, max: maxAttempts };
};

interface MetaCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}

const MetaCard = ({ icon, label, value, highlight }: MetaCardProps) => (
  <div
    className={cn(
      "flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-3 text-center",
      highlight
        ? "border-primary-200 bg-primary-50"
        : "border-neutral-100 bg-white"
    )}
  >
    <div className="text-primary-400">{icon}</div>
    <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
      {label}
    </span>
    <span className="text-sm font-bold text-neutral-800">{value}</span>
  </div>
);

export const AssessmentInstructions = ({
  instructions,
  duration,
  preview,
  canSwitchSections,
  assessmentInfo,
}: AssessmentInstructionsProps) => {
  const { used, max } = getAttemptInfo(assessmentInfo);
  const showAttempts =
    assessmentInfo.play_mode !== "PRACTICE" &&
    assessmentInfo.play_mode !== "MOCK";

  const { cleanHtml, attachments } = useMemo(
    () => parseInstructions(instructions),
    [instructions]
  );
  const hasInstructionText = cleanHtml.replace(/<[^>]+>/g, "").trim() !== "";
  const pdfAttachments = attachments.filter((a) => a.isPdf);
  const fileAttachments = attachments.filter((a) => !a.isPdf);

  return (
    <div className="w-full space-y-5">
      {/* Attempt badge */}
      {showAttempts && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
            <ListChecks size={13} weight="bold" />
            Attempt {used + 1} of {max}
          </span>
          {used > 0 && (
            <span className="text-xs text-neutral-400">
              ({used} previous {used === 1 ? "attempt" : "attempts"})
            </span>
          )}
        </div>
      )}

      {/* Meta cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetaCard
          icon={<Clock size={20} weight="duotone" />}
          label="Duration"
          value={formatDuration(duration * 60)}
        />
        <MetaCard
          icon={<Eye size={20} weight="duotone" />}
          label="Preview"
          value={preview ? "Yes" : "No"}
          highlight={preview}
        />
        <MetaCard
          icon={<ArrowsLeftRight size={20} weight="duotone" />}
          label="Switch Sections"
          value={canSwitchSections ? "Yes" : "No"}
          highlight={canSwitchSections}
        />
        {showAttempts && (
          <MetaCard
            icon={<ListChecks size={20} weight="duotone" />}
            label="Max Attempts"
            value={String(max)}
          />
        )}
      </div>

      {/* Instructions */}
      {(hasInstructionText ||
        fileAttachments.length > 0 ||
        attachments.length === 0) && (
        <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Info size={16} weight="duotone" className="text-primary-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
              Assessment Instructions
            </h2>
          </div>
          {hasInstructionText ? (
            <div
              className="prose prose-sm max-w-none text-neutral-700"
              dangerouslySetInnerHTML={{ __html: cleanHtml }}
            />
          ) : attachments.length === 0 ? (
            <p className="text-sm text-neutral-400 italic">
              No instructions provided for this assessment.
            </p>
          ) : null}

          {/* Non-PDF attachments (docs, images, …) as download links */}
          {fileAttachments.length > 0 && (
            <div className="mt-4 space-y-2">
              {fileAttachments.map((att) => (
                <a
                  key={att.url}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 transition-colors hover:border-primary-200 hover:bg-primary-50"
                >
                  <Paperclip
                    size={16}
                    weight="duotone"
                    className="shrink-0 text-primary-400"
                  />
                  <span className="truncate">{att.fileName}</span>
                  <ArrowSquareOut
                    size={14}
                    className="ms-auto shrink-0 text-neutral-400"
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Question paper(s) rendered inline */}
      {pdfAttachments.map((att) => (
        <div
          key={att.url}
          className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-neutral-100 p-4">
            <FilePdf size={16} weight="duotone" className="text-danger-500" />
            <h2
              className="truncate text-sm font-semibold uppercase tracking-wide text-neutral-600"
              title={att.fileName}
            >
              {att.fileName}
            </h2>
          </div>
          <div className="h-screen-70 w-full">
            <SimplePDFViewer pdfUrl={att.url} />
          </div>
        </div>
      ))}
    </div>
  );
};
