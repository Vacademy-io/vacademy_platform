import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Sparkle, Trash, WarningCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyInput } from '@/components/design-system/input';
import { cn } from '@/lib/utils';
import type { DigitisedPaper } from '@/services/paper-digitise';
import { MathHtml } from '@/routes/knowledge-base/-components/paper/MathHtml';

/** One question the teacher has accepted, with the marks the checker will use. */
export interface ReviewedQuestion {
    /** Index into `paper.questions` / `paper.raw_questions`. */
    index: number;
    marks: number;
}

interface RowState {
    index: number;
    marks: string;
    removed: boolean;
}

const stripHtml = (html: string | null | undefined): string => {
    if (!html) return '';
    if (typeof DOMParser === 'undefined') return html.replace(/<[^>]+>/g, ' ');
    const text = new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
};

/** Types the checker marks against a key; without one it has to judge alone. */
const KEYED_TYPES = new Set(['MCQS', 'MCQM', 'TRUE_FALSE', 'ONE_WORD', 'NUMERIC']);

const TYPE_LABEL: Record<string, string> = {
    MCQS: 'MCQ',
    MCQM: 'MCQ (multi)',
    TRUE_FALSE: 'True / False',
    ONE_WORD: 'One word',
    NUMERIC: 'Numeric',
    LONG_ANSWER: 'Written',
};

/**
 * What the model read out of the attached paper, before it becomes the test.
 *
 * The marks column is the point of this screen: every number here is the AI
 * checker's maximum for that question, so the teacher sees them all at once,
 * fixes the ones the paper did not print, and drops anything that is not a
 * question (an instruction line read as one). Also the moment the credits
 * already spent, and the per-sheet checking cost to come, are stated plainly.
 */
export const PaperDigitiseReviewDialog = ({
    open,
    paper,
    expectedTotal,
    busy,
    onConfirm,
    onCreateWithoutAi,
    onClose,
    secondaryLabel,
    primaryLabel,
}: {
    open: boolean;
    paper: DigitisedPaper | null;
    /** The total the teacher typed in the form, if any. */
    expectedTotal: number | null;
    busy: boolean;
    onConfirm: (questions: ReviewedQuestion[]) => void;
    onCreateWithoutAi: () => void;
    onClose: () => void;
    /** The secondary action's label; defaults to "Create without AI checking". */
    secondaryLabel?: string;
    /** The primary action's label; defaults to "Create test with N questions". */
    primaryLabel?: (count: number) => string;
}) => {
    const { t } = useTranslation('studyLibraryAssessmentCreateForm');
    const [rows, setRows] = useState<RowState[]>([]);

    useEffect(() => {
        if (!paper) return;
        setRows(
            paper.raw_questions.map((raw, index) => ({
                index,
                marks: raw.marks != null ? String(raw.marks) : '',
                removed: false,
            }))
        );
    }, [paper]);

    const kept = rows.filter((row) => !row.removed);
    const invalid = kept.filter((row) => !(parseFloat(row.marks) > 0));
    const total = useMemo(
        () => kept.reduce((sum, row) => sum + (parseFloat(row.marks) || 0), 0),
        [kept]
    );
    const totalMismatch = expectedTotal != null && Math.abs(total - expectedTotal) > 0.001;

    if (!paper) return null;

    const setMarks = (index: number, marks: string) =>
        setRows((prev) => prev.map((row) => (row.index === index ? { ...row, marks } : row)));
    const remove = (index: number) =>
        setRows((prev) => prev.map((row) => (row.index === index ? { ...row, removed: true } : row)));
    const restore = (index: number) =>
        setRows((prev) => prev.map((row) => (row.index === index ? { ...row, removed: false } : row)));

    const confirm = () =>
        onConfirm(kept.map((row) => ({ index: row.index, marks: parseFloat(row.marks) })));

    return (
        <MyDialog
            heading={t('review.heading', { count: kept.length })}
            open={open}
            onOpenChange={(next) => {
                if (!next && !busy) onClose();
            }}
            dialogWidth="max-w-4xl"
            footer={
                <>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        disable={busy}
                        onClick={onCreateWithoutAi}
                    >
                        {secondaryLabel ?? t('review.createWithoutAi')}
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        disable={busy || kept.length === 0 || invalid.length > 0}
                        onClick={confirm}
                    >
                        {busy
                            ? t('review.creating')
                            : primaryLabel
                              ? primaryLabel(kept.length)
                              : t('review.createWithQuestions', { count: kept.length })}
                    </MyButton>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                {/* Credits: what was just spent, and what each sheet will cost */}
                <div className="flex flex-col gap-2 rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm text-neutral-700">
                    <div className="flex items-center gap-2 font-medium text-neutral-800">
                        <Coins className="size-4 text-primary-500" weight="bold" />
                        {paper.billed && paper.credits_charged != null
                            ? t('review.creditsCharged', {
                                  credits: paper.credits_charged,
                                  count: paper.pages,
                              })
                            : t('review.creditsChargedUnknown', {
                                  credits: paper.estimate.estimated_credits,
                              })}
                        {paper.balance_after != null && (
                            <span className="text-neutral-500">
                                · {t('review.balanceNow', { balance: paper.balance_after })}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-neutral-600">
                        {t('review.perSheetCost', { count: kept.length })}
                    </p>
                </div>

                {/* Totals */}
                <div
                    className={cn(
                        'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border p-3 text-sm',
                        totalMismatch
                            ? 'border-warning-200 bg-warning-50 text-warning-700'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-700'
                    )}
                >
                    <span className="font-medium">
                        {t('review.totalLine', { count: kept.length, total })}
                    </span>
                    {paper.total_marks != null && (
                        <span>{t('review.paperStates', { total: paper.total_marks })}</span>
                    )}
                    {totalMismatch && (
                        <span>{t('review.youEntered', { total: expectedTotal })}</span>
                    )}
                    {paper.duration_minutes != null && (
                        <span>{t('review.paperDuration', { count: paper.duration_minutes })}</span>
                    )}
                </div>

                {paper.warnings.length > 0 && (
                    <ul className="flex flex-col gap-1 rounded-lg border border-warning-200 bg-warning-50 p-3">
                        {paper.warnings.map((warning) => (
                            <li
                                key={warning}
                                className="flex items-start gap-2 text-caption text-warning-700"
                            >
                                <WarningCircle className="mt-0.5 size-4 shrink-0" />
                                {warning}
                            </li>
                        ))}
                    </ul>
                )}

                {invalid.length > 0 && (
                    <p className="text-caption text-danger-600">
                        {t('review.marksRequired', { count: invalid.length })}
                    </p>
                )}

                {/* Questions */}
                <ol className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                    {rows.map((row) => {
                        const raw = paper.raw_questions[row.index];
                        const dto = paper.questions[row.index];
                        if (!raw || !dto) return null;
                        const type = String(dto.question_type || raw.question_type || '');
                        const guessed = raw.marks_source === 'split' || raw.marks_source === 'default';
                        return (
                            <li
                                key={row.index}
                                className={cn(
                                    'flex items-start gap-3 p-3',
                                    row.removed && 'bg-neutral-50 opacity-60'
                                )}
                            >
                                <span className="w-12 shrink-0 pt-2 text-caption font-semibold text-neutral-500">
                                    Q{String(raw.question_number ?? row.index + 1)}
                                </span>
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    {stripHtml(dto.text?.content) ? (
                                        // Typeset, not the LaTeX source: a maths
                                        // paper reads as "$2 \mathrm{x}-5
                                        // \mathrm{y}=7$" otherwise.
                                        <MathHtml
                                            html={dto.text?.content ?? ''}
                                            className={cn(
                                                'line-clamp-2 text-body text-neutral-800 [&_p]:inline',
                                                row.removed && 'line-through'
                                            )}
                                        />
                                    ) : (
                                        <p
                                            className={cn(
                                                'line-clamp-2 text-body text-neutral-800',
                                                row.removed && 'line-through'
                                            )}
                                        >
                                            {t('review.unreadableQuestion')}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-caption text-neutral-600">
                                            {TYPE_LABEL[type] ?? type}
                                        </span>
                                        {raw.section && (
                                            <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-caption text-neutral-600">
                                                {raw.section}
                                            </span>
                                        )}
                                        {raw.answer_source === 'model' && (
                                            <span className="flex items-center gap-1 rounded-md bg-info-50 px-2 py-0.5 text-caption text-info-700">
                                                <Sparkle className="size-3" />
                                                {t('review.aiSuggestedAnswer')}
                                            </span>
                                        )}
                                        {guessed && !row.removed && (
                                            <span className="rounded-md bg-warning-50 px-2 py-0.5 text-caption text-warning-700">
                                                {t('review.marksGuessed')}
                                            </span>
                                        )}
                                        {KEYED_TYPES.has(type) && raw.answer_source === 'none' && !row.removed && (
                                            <span className="rounded-md bg-danger-50 px-2 py-0.5 text-caption text-danger-700">
                                                {t('review.noAnswer')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {row.removed ? (
                                    <MyButton
                                        buttonType="text"
                                        scale="small"
                                        onClick={() => restore(row.index)}
                                        disable={busy}
                                    >
                                        {t('review.restore')}
                                    </MyButton>
                                ) : (
                                    <>
                                        <MyInput
                                            inputType="number"
                                            input={row.marks}
                                            onChangeFunction={(e) => setMarks(row.index, e.target.value)}
                                            size="small"
                                            className="w-20 sm:w-20"
                                            min={0.5}
                                            step={0.5}
                                            error={
                                                parseFloat(row.marks) > 0
                                                    ? undefined
                                                    : t('review.marksInvalid')
                                            }
                                            onWheel={(e) => e.currentTarget.blur()}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => remove(row.index)}
                                            disabled={busy}
                                            aria-label={t('review.removeQuestion')}
                                            className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-danger-50 hover:text-danger-500"
                                        >
                                            <Trash className="size-4" />
                                        </button>
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </div>
        </MyDialog>
    );
};
