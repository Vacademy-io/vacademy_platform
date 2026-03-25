import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { ScoringMode } from '../-utils/types';

interface OfflineEntrySubmitDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    answeredCount: number;
    unansweredCount: number;
    scoringMode: ScoringMode;
    studentName: string;
    isSubmitting: boolean;
    onConfirm: () => void;
}

export const OfflineEntrySubmitDialog = ({
    open,
    onOpenChange,
    answeredCount,
    unansweredCount,
    scoringMode,
    studentName,
    isSubmitting,
    onConfirm,
}: OfflineEntrySubmitDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Confirm Submission</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3 py-4 text-sm">
                    <p>
                        <span className="font-medium">Student:</span> {studentName}
                    </p>
                    <p>
                        <span className="font-medium">Scoring Mode:</span>{' '}
                        {scoringMode === 'AUTO_CALCULATE' ? 'Auto-Calculate' : 'Direct Marks'}
                    </p>
                    <div className="flex gap-4">
                        <span className="rounded-md bg-green-50 px-2 py-1 text-green-700">
                            {answeredCount} answered
                        </span>
                        <span className="rounded-md bg-gray-50 px-2 py-1 text-gray-500">
                            {unansweredCount} unanswered
                        </span>
                    </div>
                    {unansweredCount > 0 && (
                        <p className="text-xs text-amber-600">
                            Unanswered questions will be scored as 0 marks.
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="rounded-md border px-4 py-2 text-sm"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className="rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
