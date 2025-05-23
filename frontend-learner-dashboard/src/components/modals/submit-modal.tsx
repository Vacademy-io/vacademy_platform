import { useState } from "react";
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

interface SubmitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function SubmitModal({ open, onOpenChange, onConfirm }: SubmitModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useProctoring({
    forceFullScreen: false,
    preventTabSwitch: false,
    preventContextMenu: false,
    preventUserSelection: false,
    preventCopy: false,
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      onConfirm();
    } catch  {
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