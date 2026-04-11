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
import { AlertCircle, Loader2 } from "lucide-react";
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
            <AlertCircle className="h-5 w-5 text-primary-500" />
            Submit Assessment
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to submit your responses? Before submitting, make sure you have given your best responses.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {counts.total > 0 && (
          <div className="grid grid-cols-2 gap-2 rounded-md border bg-gray-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total</span>
              <span className="font-semibold">{counts.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-emerald-700">Answered</span>
              <span className="font-semibold text-emerald-700">{counts.answered}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-rose-700">Unanswered</span>
              <span className="font-semibold text-rose-700">{counts.unanswered}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-700">Marked for review</span>
              <span className="font-semibold text-amber-700">{counts.marked}</span>
            </div>
            {counts.notVisited > 0 && (
              <div className="col-span-2 flex items-center justify-between">
                <span className="text-gray-500">Not visited</span>
                <span className="font-semibold text-gray-600">{counts.notVisited}</span>
              </div>
            )}
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
                <Loader2 className="h-4 w-4 animate-spin" />
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