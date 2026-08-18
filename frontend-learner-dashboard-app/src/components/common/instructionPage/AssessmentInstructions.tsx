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
  ShieldCheck,
  ArrowsClockwise,
  SquaresFour,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import SimplePDFViewer from "@/components/common/simple-pdf-viewer";
import type { ExamExperienceSettings } from "@/types/assessment-experience";

interface AssessmentInstructionsProps {
  instructions: string;
  duration: number;
  preview: boolean;
  canSwitchSections: boolean;
  assessmentInfo: Assessment;
  examExperience: ExamExperienceSettings;
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

interface StatCardProps {
  label: string;
  value: string;
}

const StatCard = ({ label, value }: StatCardProps) => (
  <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 sm:px-4">
    <p className="mb-1.5 text-3xs font-bold uppercase tracking-wide text-neutral-400">
      {label}
    </p>
    <p className="text-title font-bold text-neutral-900 sm:text-h3">{value}</p>
  </div>
);

interface RuleRowProps {
  icon: ReactNode;
  title: string;
  body: string;
  isFirst?: boolean;
}

const RuleRow = ({ icon, title, body, isFirst }: RuleRowProps) => (
  <div
    className={cn(
      "flex gap-3.5 px-4 py-4 sm:px-5",
      !isFirst && "border-t border-neutral-100"
    )}
  >
    <span className="grid size-8 flex-none place-items-center rounded-lg bg-neutral-100 text-neutral-600">
      {icon}
    </span>
    <div className="min-w-0">
      <p className="mb-1 text-body font-semibold text-neutral-900">{title}</p>
      <p className="text-caption leading-relaxed text-neutral-500">{body}</p>
    </div>
  </div>
);

export const AssessmentInstructions = ({
  instructions,
  duration,
  preview,
  canSwitchSections,
  assessmentInfo,
  examExperience,
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

  // "How this test works" is generated from the real attempt configuration and
  // the institute's live-test settings, not authored copy — so it can never
  // promise a learner a tool the exam shell will not actually show them.
  const tools = [
    examExperience.calculator.enabled &&
      (examExperience.calculator.mode === "scientific"
        ? "a scientific calculator"
        : "a calculator"),
    examExperience.scratchpad.enabled && "a scratchpad for rough work",
  ].filter(Boolean) as string[];

  return (
    <div className="w-full space-y-5">
      {/* Title block */}
      <div>
        {showAttempts && (
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-2xs font-semibold text-primary-500">
            <ListChecks size={13} weight="bold" />
            Attempt {used + 1} of {max}
          </span>
        )}
        <h1 className="text-h2 font-bold leading-tight text-neutral-900 sm:text-h1">
          {assessmentInfo.name}
        </h1>
        <p className="mt-2 text-body text-neutral-500">
          Read these before you begin. The timer starts the moment you enter the
          test.
        </p>
      </div>

      {/* Headline numbers. Labels are kept to one word so all three cards stay
          the same height on a 360px phone. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Duration" value={formatDuration(duration * 60)} />
        <StatCard label="Preview" value={preview ? "Yes" : "No"} />
        {/* Terse on purpose — the rule row below spells out what section
            switching actually means for this paper. */}
        <StatCard label="Switching" value={canSwitchSections ? "Yes" : "No"} />
      </div>

      {/* How this test works */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <RuleRow
          isFirst
          icon={<Clock size={17} weight="duotone" />}
          title={`${formatDuration(duration * 60)} on the clock`}
          body={
            canSwitchSections
              ? "You may move between sections freely until the overall timer ends."
              : "Sections open in order. Once a section's time ends you cannot return to it."
          }
        />
        <RuleRow
          icon={<ShieldCheck size={17} weight="duotone" />}
          title="Stay in full screen"
          body="The test runs in full screen. Leaving it, switching tabs, or opening another window is recorded. Three warnings will auto-submit your paper."
        />
        <RuleRow
          icon={<ArrowsClockwise size={17} weight="duotone" />}
          title="Your answers save automatically"
          body="Every response syncs as you go. If your connection drops, answers are held on this device and re-sent when you are back online."
        />
        {examExperience.questionPalette.enabled && (
          <RuleRow
            icon={<SquaresFour size={17} weight="duotone" />}
            title="Use the question palette"
            body="The palette shows what is answered, skipped or marked for review. Marking a question for review still submits any answer you selected."
          />
        )}
        {tools.length > 0 && (
          <RuleRow
            icon={<ArrowsLeftRight size={17} weight="duotone" />}
            title="Tools you can use"
            body={`This test gives you ${tools.join(" and ")}. Open them from the toolbar during the test.`}
          />
        )}
        {showAttempts && (
          <RuleRow
            icon={<ListChecks size={17} weight="duotone" />}
            title={`Attempt ${used + 1} of ${max}`}
            body={
              used > 0
                ? `You have already used ${used} ${used === 1 ? "attempt" : "attempts"} on this paper.`
                : "This is your first attempt on this paper."
            }
          />
        )}
        {preview && (
          <RuleRow
            icon={<Eye size={17} weight="duotone" />}
            title="Preview before you start"
            body="You get a read-only look at the paper before the answering time begins."
          />
        )}
      </div>

      {/* Institute-authored instructions */}
      {(hasInstructionText ||
        fileAttachments.length > 0 ||
        attachments.length === 0) && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Info size={16} weight="duotone" className="text-neutral-400" />
            <h2 className="text-caption font-bold uppercase tracking-wide text-neutral-500">
              Instructions from your institute
            </h2>
          </div>
          {hasInstructionText ? (
            <div
              className="richtext-content text-body text-neutral-700"
              dangerouslySetInnerHTML={{ __html: cleanHtml }}
            />
          ) : attachments.length === 0 ? (
            <p className="text-body italic text-neutral-400">
              No additional instructions were provided for this assessment.
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
                  className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-body text-neutral-700 transition-colors hover:border-primary-200 hover:bg-primary-50"
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
          className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
        >
          <div className="flex items-center gap-2 border-b border-neutral-100 p-4">
            <FilePdf size={16} weight="duotone" className="text-danger-500" />
            <h2
              className="truncate text-caption font-bold uppercase tracking-wide text-neutral-500"
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
