import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Coins, FilePdf, Sparkle, Spinner, WarningCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyDropdown } from '@/components/design-system/dropdown';
import { cn } from '@/lib/utils';
import { savePaperToQuestionBank } from '@/routes/knowledge-base/-services/paper-service';
import { getQuestionPaperById } from '@/routes/assessment/question-papers/-utils/question-paper-services';
import { triggerAIEvaluation } from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-services/ai-evaluation-services';
import {
    adoptDigitisedQuestions,
    estimatePaperDigitise,
    findPdfAttachments,
    getAiGradability,
    paperDigitiseErrorMessage,
    type AdoptQuestionsResult,
    type DigitisedPaper,
    type PaperDigitiseEstimate,
} from '@/services/paper-digitise';
import { usePaperDigitise } from '../-hooks/use-paper-digitise';
import { PaperDigitiseReviewDialog, type ReviewedQuestion } from './paper-digitise-review-dialog';

type Step =
    | { kind: 'closed' }
    | { kind: 'confirm'; estimate?: PaperDigitiseEstimate; error?: string; loading: boolean }
    | { kind: 'adopting' }
    | { kind: 'done'; result: AdoptQuestionsResult; questionCount: number };

/**
 * "Enable AI checking" for a test that was created without it.
 *
 * Such a test holds one placeholder question, so the AI has nothing to grade
 * against — and it refuses to run. This reads the paper still attached in the
 * test's description into real questions (same review as at creation), swaps
 * them in for the placeholder on the server (same section, so nothing an
 * attempt points at changes), turns AI checking on, and readies every sheet
 * already uploaded. Sheets the teacher graded by hand are left alone.
 *
 * Rendered only while the test is placeholder-only; disappears once enabled.
 */
export const EnableAiChecking = ({
    assessmentId,
    instructionsHtml,
    totalMarks,
    framed = false,
    onEnabled,
}: {
    assessmentId: string;
    /** The test's saved instructions — where the paper PDF was attached. */
    instructionsHtml: string | null | undefined;
    /** The placeholder's marks, i.e. the paper's total as the teacher typed it. */
    totalMarks: number | null;
    /** Stand-alone card (own border + margin) rather than a strip inside a panel. */
    framed?: boolean;
    onEnabled?: () => void;
}) => {
    const { t } = useTranslation('studyLibraryAssessmentCreateForm');
    const queryClient = useQueryClient();
    const { state, starting, start, abandon } = usePaperDigitise();
    const [step, setStep] = useState<Step>({ kind: 'closed' });
    const [checking, setChecking] = useState(false);
    // Bank ids already saved for this exact set — a retry after the adopt call
    // failed must not file the same paper into the bank twice.
    const savedRef = useRef<{ key: string; ids: string[] } | null>(null);

    const { data: gradability } = useQuery({
        queryKey: ['AI_GRADABILITY', assessmentId],
        queryFn: () => getAiGradability(assessmentId),
        enabled: Boolean(assessmentId),
        staleTime: 60 * 1000,
    });

    const pdfs = useMemo(() => findPdfAttachments(instructionsHtml || ''), [instructionsHtml]);
    const [selectedUrl, setSelectedUrl] = useState('');
    const pdfUrl = pdfs.some((p) => p.url === selectedUrl) ? selectedUrl : (pdfs[0]?.url ?? '');

    if (!gradability?.placeholder_only) return null;

    const openConfirm = async (url: string) => {
        setStep({ kind: 'confirm', loading: true });
        try {
            const estimate = await estimatePaperDigitise(url);
            setStep({ kind: 'confirm', estimate, loading: false });
        } catch (error: unknown) {
            setStep({
                kind: 'confirm',
                error: paperDigitiseErrorMessage(error, t('aiCheck.estimateFailed')),
                loading: false,
            });
        }
    };

    const beginRead = async () => {
        if (!pdfUrl) return;
        setStep({ kind: 'closed' });
        await start({
            pdfUrl,
            expectedTotalMarks: totalMarks && totalMarks > 0 ? totalMarks : undefined,
        });
    };

    const adopt = async (paper: DigitisedPaper, accepted: ReviewedQuestion[]) => {
        setStep({ kind: 'adopting' });
        try {
            const questions = accepted.map(({ index, marks }) => {
                const dto = paper.questions[index]!;
                // Marks corrected on review → the rubric's maximum must follow.
                let criteria = dto.evaluation_criteria_json ?? null;
                try {
                    const parsed = criteria ? JSON.parse(criteria) : null;
                    if (parsed && typeof parsed === 'object' && Number(parsed.max_marks) !== marks) {
                        const items: Array<{ max_marks?: number }> = Array.isArray(parsed.rubric)
                            ? parsed.rubric
                            : [];
                        const oldTotal = items.reduce((sum, c) => sum + Number(c.max_marks || 0), 0);
                        const factor = oldTotal > 0 ? marks / oldTotal : 0;
                        items.forEach((c) => {
                            c.max_marks = Math.round(Number(c.max_marks || 0) * factor * 100) / 100;
                        });
                        parsed.max_marks = marks;
                        criteria = JSON.stringify(parsed);
                    }
                } catch {
                    /* keep the rubric as generated */
                }
                return { dto: { ...dto, evaluation_criteria_json: criteria }, marks };
            });
            const cacheKey = JSON.stringify([paper.file_name, paper.estimate, accepted]);
            let ids: string[];
            if (savedRef.current?.key === cacheKey) {
                ids = savedRef.current.ids;
            } else {
                const saved = await savePaperToQuestionBank({
                    title: paper.title,
                    questions: questions.map((q) => q.dto),
                });
                const savedId = saved?.saved_question_paper_id;
                if (!savedId) throw new Error(t('errors.questionsNotSaved'));
                const stored = await getQuestionPaperById(savedId);
                ids = (stored?.question_dtolist ?? []).map((q: { id: string }) => q.id);
                if (ids.length !== questions.length) throw new Error(t('errors.questionsNotSaved'));
                savedRef.current = { key: cacheKey, ids };
            }

            const result = await adoptDigitisedQuestions(
                assessmentId,
                questions.map((q, i) => ({
                    question_id: ids[i]!,
                    question_type: String(q.dto.question_type || 'LONG_ANSWER'),
                    marks: q.marks,
                }))
            );
            abandon();
            queryClient.invalidateQueries({ queryKey: ['AI_GRADABILITY', assessmentId] });
            queryClient.invalidateQueries({ queryKey: ['GET_QUESTIONS_DATA_FOR_SECTIONS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_ASSESSMENT_DETAILS'] });
            setStep({ kind: 'done', result, questionCount: questions.length });
            onEnabled?.();
        } catch (error: unknown) {
            toast.error(paperDigitiseErrorMessage(error, t('retrofit.enableFailed')));
            // Back to the review so the questions are not lost; a retry re-uses them.
            setStep({ kind: 'closed' });
        }
    };

    const checkNow = async (result: AdoptQuestionsResult) => {
        setChecking(true);
        try {
            const processes = await triggerAIEvaluation(result.attempt_ids_ready);
            toast.success(t('retrofit.checkStarted', { count: processes.length }));
            queryClient.invalidateQueries({ queryKey: ['ASSESSMENT_SLIDE_SUBMISSIONS_PANEL'] });
            setStep({ kind: 'closed' });
        } catch (error: unknown) {
            toast.error(paperDigitiseErrorMessage(error, t('retrofit.checkFailed')));
        } finally {
            setChecking(false);
        }
    };

    const estimateData = step.kind === 'confirm' ? step.estimate : undefined;

    return (
        <>
            <div
                className={cn(
                    'flex flex-col gap-2 bg-primary-50/40 px-3 py-2.5',
                    framed
                        ? 'mx-4 rounded-md border border-primary-100'
                        : 'border-b border-neutral-100'
                )}
            >
                <div className="flex items-start gap-2">
                    <Sparkle className="mt-0.5 size-4 shrink-0 text-primary-500" weight="bold" />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-xs font-semibold text-neutral-800">
                            {t('retrofit.title')}
                        </span>
                        <span className="text-2xs text-neutral-500">
                            {pdfs.length > 0 ? t('retrofit.description') : t('retrofit.noPdf')}
                        </span>
                    </div>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        disable={pdfs.length === 0 || starting || state.phase === 'running'}
                        onClick={() => void openConfirm(pdfUrl)}
                    >
                        <span className="text-xs">{t('retrofit.enableButton')}</span>
                    </MyButton>
                </div>
                {pdfs.length > 1 && (
                    <MyDropdown
                        currentValue={pdfs.find((p) => p.url === pdfUrl)?.name ?? ''}
                        dropdownList={pdfs.map((p) => ({ label: p.name, value: p.url }))}
                        placeholder={t('aiCheck.whichPaper')}
                        handleChange={setSelectedUrl}
                    />
                )}
            </div>

            {/* Cost confirmation before anything is charged */}
            <MyDialog
                heading={t('retrofit.confirmHeading')}
                open={step.kind === 'confirm'}
                onOpenChange={(next) => {
                    if (!next) setStep({ kind: 'closed' });
                }}
                dialogWidth="max-w-lg"
                footer={
                    <>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setStep({ kind: 'closed' })}
                        >
                            {t('form.cancel')}
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            disable={
                                !estimateData || estimateData.estimate.sufficient === false || starting
                            }
                            onClick={() => void beginRead()}
                        >
                            {estimateData
                                ? t('form.readPaperAndCreateNoEstimate') +
                                  ` (≈${estimateData.estimate.estimated_credits})`
                                : t('form.readPaperAndCreateNoEstimate')}
                        </MyButton>
                    </>
                }
            >
                {step.kind === 'confirm' && (
                    <div className="flex flex-col gap-3 text-body text-neutral-700">
                        <p className="flex items-center gap-2">
                            <FilePdf className="size-4 shrink-0 text-danger-500" />
                            <span className="truncate">{pdfs.find((p) => p.url === pdfUrl)?.name}</span>
                        </p>
                        {step.loading && (
                            <p className="flex items-center gap-2 text-caption text-neutral-500">
                                <Spinner className="size-4 animate-spin" />
                                {t('aiCheck.estimating')}
                            </p>
                        )}
                        {step.error && (
                            <p className="flex items-start gap-2 text-caption text-danger-600">
                                <WarningCircle className="mt-0.5 size-4 shrink-0" />
                                {step.error}
                            </p>
                        )}
                        {estimateData && (
                            <>
                                <p className="flex items-center gap-2 font-medium">
                                    <Coins className="size-4 text-primary-500" weight="bold" />
                                    {t('aiCheck.estimateLine', {
                                        credits: estimateData.estimate.estimated_credits,
                                        count: estimateData.pages,
                                    })}
                                    {estimateData.estimate.current_balance != null && (
                                        <span className="font-normal text-neutral-500">
                                            · {t('aiCheck.balance', { balance: estimateData.estimate.current_balance })}
                                        </span>
                                    )}
                                </p>
                                {estimateData.estimate.sufficient === false ? (
                                    <p className="text-caption text-danger-600">
                                        {t('aiCheck.insufficientCredits')}
                                    </p>
                                ) : (
                                    <p className="text-caption text-neutral-500">{t('retrofit.confirmBody')}</p>
                                )}
                            </>
                        )}
                    </div>
                )}
            </MyDialog>

            {/* Reading / failed */}
            <MyDialog
                heading={
                    state.phase === 'failed' ? t('aiCheck.failedHeading') : t('aiCheck.readingHeading')
                }
                open={state.phase === 'running' || state.phase === 'failed'}
                onOpenChange={(next) => {
                    if (!next && state.phase === 'failed') abandon();
                }}
                dialogWidth="max-w-lg"
                footer={
                    state.phase === 'failed' ? (
                        <>
                            <MyButton buttonType="secondary" scale="medium" onClick={abandon}>
                                {t('form.cancel')}
                            </MyButton>
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                disable={starting}
                                onClick={() => void beginRead()}
                            >
                                {t('aiCheck.tryAgain')}
                            </MyButton>
                        </>
                    ) : (
                        <MyButton buttonType="secondary" scale="medium" onClick={abandon}>
                            {t('retrofit.stopWaiting')}
                        </MyButton>
                    )
                }
            >
                {state.phase === 'failed' ? (
                    <div className="flex flex-col gap-3">
                        <p className="flex items-start gap-2 text-body text-danger-600">
                            <WarningCircle className="mt-0.5 size-5 shrink-0" />
                            {state.message}
                        </p>
                        <p className="text-caption text-neutral-500">{t('retrofit.failedHint')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <p className="flex items-center gap-3 text-body text-neutral-700">
                            <Spinner className="size-5 shrink-0 animate-spin text-primary-500" />
                            {t('retrofit.readingBody')}
                        </p>
                        <p className="text-caption text-neutral-500">{t('aiCheck.readingHint')}</p>
                        <p className="text-caption text-neutral-500">{t('aiCheck.skipNote')}</p>
                    </div>
                )}
            </MyDialog>

            <PaperDigitiseReviewDialog
                open={state.phase === 'review' || step.kind === 'adopting'}
                paper={state.phase === 'review' ? state.paper : null}
                expectedTotal={totalMarks}
                busy={step.kind === 'adopting'}
                onConfirm={(accepted) => {
                    if (state.phase === 'review') void adopt(state.paper, accepted);
                }}
                onCreateWithoutAi={() => {
                    abandon();
                    toast.info(t('aiCheck.reviewClosed'));
                }}
                onClose={() => {
                    abandon();
                    toast.info(t('aiCheck.reviewClosed'));
                }}
                secondaryLabel={t('form.cancel')}
                primaryLabel={(count) => t('retrofit.enableWithQuestions', { count })}
            />

            {/* Done: what changed, and the sheets that can be checked right now */}
            <MyDialog
                heading={t('retrofit.doneHeading')}
                open={step.kind === 'done'}
                onOpenChange={(next) => {
                    if (!next && !checking) setStep({ kind: 'closed' });
                }}
                dialogWidth="max-w-lg"
                footer={
                    step.kind === 'done' ? (
                        <>
                            <MyButton
                                buttonType="secondary"
                                scale="medium"
                                disable={checking}
                                onClick={() => setStep({ kind: 'closed' })}
                            >
                                {t('retrofit.later')}
                            </MyButton>
                            {step.result.attempt_ids_ready.length > 0 && (
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    disable={checking}
                                    onClick={() => void checkNow(step.result)}
                                >
                                    {checking
                                        ? t('retrofit.checking')
                                        : t('retrofit.checkNow', {
                                              count: step.result.attempt_ids_ready.length,
                                              credits:
                                                  step.result.attempt_ids_ready.length * step.questionCount,
                                          })}
                                </MyButton>
                            )}
                        </>
                    ) : undefined
                }
            >
                {step.kind === 'done' && (
                    <ul className="flex flex-col gap-2 text-body text-neutral-700">
                        <li>
                            {t('retrofit.doneQuestions', {
                                count: step.result.questions_mapped,
                                total: step.result.total_marks,
                            })}
                        </li>
                        <li>{t('retrofit.doneReady', { count: step.result.attempt_ids_ready.length })}</li>
                        {step.result.attempts_left_as_graded > 0 && (
                            <li>{t('retrofit.doneGraded', { count: step.result.attempts_left_as_graded })}</li>
                        )}
                        {step.result.attempts_in_progress > 0 && (
                            <li>{t('retrofit.doneInProgress', { count: step.result.attempts_in_progress })}</li>
                        )}
                        <li className="text-caption text-neutral-500">{t('retrofit.doneFuture')}</li>
                    </ul>
                )}
            </MyDialog>
        </>
    );
};
