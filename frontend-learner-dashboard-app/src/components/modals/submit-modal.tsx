import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProctoring } from "@/hooks";
import { WarningCircle, SpinnerGap } from "@phosphor-icons/react";
import { useAssessmentStore } from "@/stores/assessment-store";

interface SubmitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function SubmitModal({ open, onOpenChange, onConfirm }: SubmitModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const assessment = useAssessmentStore((s) => s.assessment);
  const questionStates = useAssessmentStore((s) => s.questionStates);

  useProctoring({
    forceFullScreen: false,
    preventTabSwitch: false,
    preventContextMenu: false,
    preventUserSelection: false,
    preventCopy: false,
  });

  const counts = useMemo(() => {
    let total = 0;
    let answered = 0;
    let marked = 0;
    let notVisited = 0;
    assessment?.section_dtos?.forEach((section) => {
      section.question_preview_dto_list?.forEach((question) => {
        total += 1;
        const state = questionStates[question.question_id];
        if (state?.isAnswered) answered += 1;
        if (state?.isMarkedForReview) marked += 1;
        if (!state?.isVisited) notVisited += 1;
      });
    });
    const unanswered = Math.max(0, total - answered);
    return { total, answered, marked, unanswered, notVisited };
  }, [assessment, questionStates]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      // Close the modal after successful submission
      onOpenChange(false);
    } catch (error) {
      console.error("Submission error:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <WarningCircle className="h-5 w-5 text-primary-500" />
            Submit Assessment
          </AlertDialogTitle>
          <AlertDialogDescription>
            {counts.total > 0 && counts.unanswered > 0
              ? `${counts.unanswered} of ${counts.total} questions are still unanswered. You cannot return to the paper after submitting.`
              : "You cannot return to the paper after submitting. Make sure you have given your best responses."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {counts.total > 0 && (
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            {[
              { label: "Answered", value: counts.answered, tone: "text-success-700" },
              { label: "Unanswered", value: counts.unanswered, tone: "text-danger-600" },
              { label: "Marked for review", value: counts.marked, tone: "text-violet-700" },
              { label: "Not visited", value: counts.notVisited, tone: "text-neutral-500" },
              { label: "Total questions", value: counts.total, tone: "text-neutral-800" },
            ].map((row, index) => (
              <div
                key={row.label}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 text-body ${
                  index % 2 ? "bg-neutral-50" : "bg-white"
                } ${index ? "border-t border-neutral-100" : ""}`}
              >
                <span className={row.tone}>{row.label}</span>
                <span className="font-bold tabular-nums text-neutral-900">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction
            onClick={handleSubmit}
            className="w-full bg-primary-500 text-white relative"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <SpinnerGap className="h-4 w-4 animate-spin" />
                Submitting...
              </div>
            ) : (
              "Submit"
            )}
          </AlertDialogAction>
          <AlertDialogCancel
            className="w-full mt-0"
            disabled={isSubmitting}
            onClick={() => !isSubmitting && onOpenChange(false)}
          >
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}