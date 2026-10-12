import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Coins, Eye, Info, Robot, Spinner, WarningCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToolCostPreview } from '@/components/common/ai-credits/useToolCostPreview';
import {
    DEFAULT_EVALUATION_MODEL,
    buildModelDisplayNames,
} from '@/routes/ai-center/-types/ai-models';
import { getPublicUrl } from '@/services/upload_file';
import {
    AssignmentAiEvaluation,
    fetchAssignmentAiEvaluation,
    triggerAssignmentAiEvaluation,
} from '@/services/study-library/slide-operations/assignment-ai-evaluation';

const POLL_MS = 5000;

const errorMessage = (err: unknown, fallback: string): string => {
    const data = (err as { response?: { data?: { ex?: string; message?: string } } })?.response
        ?.data;
    return data?.ex || data?.message || fallback;
};

/**
 * "Evaluate with AI" for one assignment submission - the assessment AI Evaluator,
 * grading the whole assignment as one answer out of its total marks. The result only
 * fills the grade form (onApply); the learner sees it once the teacher saves the grade.
 */
export const AssignmentAiEvaluator = ({
    trackedId,
    hasFiles,
    onApply,
}: {
    trackedId: string;
    hasFiles: boolean;
    onApply: (evaluation: AssignmentAiEvaluation) => void;
}) => {
    const { t } = useTranslation('aiCenterAiModels');
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    // Must stay DEFAULT_EVALUATION_MODEL: the picker always sends preferred_model,
    // so its default overrides the grading pipeline's own (see the assessment dialog).
    const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_EVALUATION_MODEL);
    const modelDisplayNames = buildModelDisplayNames(t);
    // The whole assignment is graded as one question.
    const cost = useToolCostPreview('copy_check_evaluation', { num_questions: 1 });
    const queryKey = ['ASSIGNMENT_AI_EVALUATION', trackedId];

    const { data: evaluation } = useQuery({
        queryKey,
        queryFn: () => fetchAssignmentAiEvaluation(trackedId),
        enabled: !!trackedId,
        // A failed lookup only hides the AI status line; the grade form works without it.
        retry: false,
        refetchInterval: (query) =>
            query.state.data?.status === 'PROCESSING' ? POLL_MS : false,
    });

    // Fill the grade form when a run this teacher is watching finishes - not for an
    // old result found on open, which could overwrite a grade they already typed.
    const watchedRunId = useRef<string | null>(null);
    useEffect(() => {
        if (!evaluation) return;
        if (evaluation.status === 'PROCESSING') {
            watchedRunId.current = evaluation.id;
        } else if (
            evaluation.status === 'COMPLETED' &&
            watchedRunId.current === evaluation.id
        ) {
            watchedRunId.current = null;
            onApply(evaluation);
            toast.success('AI evaluation done - review the marks, then save the grade', {
                description: 'Not sent to the learner yet.',
            });
        } else if (evaluation.status === 'FAILED' && watchedRunId.current === evaluation.id) {
            watchedRunId.current = null;
        }
    }, [evaluation, onApply]);

    const triggerMutation = useMutation({
        mutationFn: () => triggerAssignmentAiEvaluation(trackedId, selectedModel),
        onSuccess: (run) => {
            queryClient.setQueryData(queryKey, run);
            setDialogOpen(false);
            if (run.status === 'FAILED') {
                toast.error(run.error_message || 'Could not start the AI evaluation');
            } else {
                watchedRunId.current = run.id;
                toast.success('AI evaluation started', {
                    description:
                        'You will get a notification and an email when it is ready for your review.',
                });
            }
        },
        onError: (err) => {
            toast.error(errorMessage(err, 'Could not start the AI evaluation'));
        },
    });

    const handleViewCheckedCopy = async (fileId: string) => {
        const url = await getPublicUrl(fileId);
        if (url) window.open(url, '_blank');
    };

    const isRunning = evaluation?.status === 'PROCESSING';

    return (
        <div className="flex flex-col gap-2">
            {isRunning && (
                <div className="flex items-center gap-2 rounded-md border border-primary-100 bg-primary-50 px-3 py-2 text-xs text-primary-700">
                    <Spinner size={14} className="shrink-0 animate-spin" />
                    <span>AI is checking this copy. This takes a minute or two.</span>
                </div>
            )}

            {evaluation?.status === 'COMPLETED' && (
                <div className="flex flex-col gap-1.5 rounded-md border border-primary-100 bg-primary-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                            <span className="w-fit rounded-full bg-warning-100 px-2 py-0.5 text-caption font-semibold text-warning-700">
                                Waiting for your review
                            </span>
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-700">
                                <Robot size={14} />
                                AI suggestion: {evaluation.marks_awarded ?? '-'}
                                {evaluation.max_marks != null && ` / ${evaluation.max_marks}`}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            {evaluation.evaluated_file_id && (
                                <MyButton
                                    type="button"
                                    buttonType="text"
                                    scale="small"
                                    onClick={() =>
                                        handleViewCheckedCopy(evaluation.evaluated_file_id!)
                                    }
                                >
                                    <Eye size={12} /> Checked copy
                                </MyButton>
                            )}
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                onClick={() => onApply(evaluation)}
                            >
                                Use in grade
                            </MyButton>
                        </div>
                    </div>
                    {evaluation.feedback && (
                        <p className="line-clamp-3 text-xs text-neutral-700">
                            {evaluation.feedback}
                        </p>
                    )}
                    <p className="text-caption text-neutral-500">
                        Not sent to the learner. Check the marks and feedback, then press Save
                        Grade - only then does the learner see it.
                    </p>
                </div>
            )}

            {evaluation?.status === 'FAILED' && (
                <div className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-xs text-danger-600">
                    <WarningCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{evaluation.error_message || 'The AI evaluation failed.'}</span>
                </div>
            )}

            <MyButton
                type="button"
                buttonType="secondary"
                scale="small"
                className="w-full"
                onClick={() => setDialogOpen(true)}
                disabled={!hasFiles || isRunning || triggerMutation.isPending}
            >
                <Robot size={14} />
                {evaluation?.status === 'COMPLETED' || evaluation?.status === 'FAILED'
                    ? 'Re-evaluate with AI'
                    : 'Evaluate with AI'}
            </MyButton>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="flex w-full max-w-lg flex-col gap-4 p-0">
                    <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">
                        Evaluate with AI
                    </h1>
                    <div className="flex flex-col gap-4 p-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-neutral-700">
                                Select AI model
                            </label>
                            <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a model" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(modelDisplayNames).map(([modelId, info]) => (
                                        <SelectItem key={modelId} value={modelId}>
                                            {info.name} - {info.description}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-start gap-2 rounded-md bg-primary-50 p-3 text-xs text-primary-700">
                            <Info size={16} className="mt-0.5 shrink-0" />
                            <p>
                                The AI reads the submitted files and grades them against the
                                assignment instructions, out of its total marks. Its marks,
                                feedback and checked copy fill the grade form - the learner sees
                                nothing until you save the grade.
                            </p>
                        </div>

                        {cost.credits != null && (
                            <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 p-3">
                                <div className="flex items-center gap-2 text-sm text-neutral-700">
                                    <Coins size={16} className="text-primary-500" />
                                    <span>
                                        Estimated cost:{' '}
                                        <span className="font-semibold text-neutral-900">
                                            {cost.credits} credits
                                        </span>
                                    </span>
                                </div>
                                {cost.currentBalance != null && (
                                    <span className="text-xs text-neutral-500">
                                        Balance: {cost.currentBalance}
                                    </span>
                                )}
                            </div>
                        )}

                        {cost.sufficient === false && (
                            <div className="flex items-start gap-2 rounded-md bg-danger-50 p-3 text-xs text-danger-600">
                                <WarningCircle size={16} className="mt-0.5 shrink-0" />
                                <p>Not enough AI credits for this evaluation.</p>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                onClick={() => setDialogOpen(false)}
                                disabled={triggerMutation.isPending}
                            >
                                Cancel
                            </MyButton>
                            <MyButton
                                type="button"
                                buttonType="primary"
                                onClick={() => triggerMutation.mutate()}
                                disabled={triggerMutation.isPending || cost.sufficient === false}
                            >
                                {triggerMutation.isPending ? 'Starting...' : 'Start evaluation'}
                            </MyButton>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AssignmentAiEvaluator;
