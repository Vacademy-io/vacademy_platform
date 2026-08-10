import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowClockwise, BookOpen, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { StatusChip } from '@/components/design-system/status-chips';
import { Card } from '@/components/ui/card';
import type { Blueprint, PaperIssue, PaperResult, RawPaperQuestion } from '../../-types/paper';

interface ReviewBoardProps {
    result: PaperResult;
    blueprint: Blueprint;
    issuesByQuestion: Map<number, PaperIssue[]>;
    regeneratingNumber: number | null;
    onRegenerate: (raw: RawPaperQuestion, instruction?: string) => void;
}

const NUDGES = [
    { label: 'Make it harder', instruction: 'Make this question harder.' },
    { label: 'Make it easier', instruction: 'Make this question easier.' },
    { label: 'More application', instruction: 'Make this test application rather than recall.' },
];

/**
 * One card per question, each showing the page it came from.
 *
 * The citation is not decoration: it is the only way a teacher can check a
 * question against the book without hunting for it, and an unverifiable question
 * paper does not get used a second time.
 */
export const ReviewBoard = ({
    result,
    blueprint,
    issuesByQuestion,
    regeneratingNumber,
    onRegenerate,
}: ReviewBoardProps) => {
    const [openNudge, setOpenNudge] = useState<number | null>(null);

    if (result.raw_questions.length === 0) {
        return (
            <Card className="flex flex-col items-center gap-2 p-8 text-center">
                <WarningCircle className="size-6 text-warning-600" />
                <p className="text-body text-neutral-600">
                    No questions could be written from the selected material.
                </p>
                <p className="text-caption text-neutral-500">
                    Try widening the chapter selection, or check that those chapters processed
                    correctly.
                </p>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {result.raw_questions.map((raw, index) => {
                const num = raw.question_number ?? index + 1;
                const issues = issuesByQuestion.get(num) ?? [];
                const errors = issues.filter((i) => i.severity === 'error');
                const warnings = issues.filter((i) => i.severity === 'warning');
                const meta = raw.kb_meta ?? {};
                const page = meta.source_page ?? raw.source_page;
                const busy = regeneratingNumber === num;

                return (
                    <Card
                        key={`${num}-${index}`}
                        className={
                            errors.length
                                ? 'flex flex-col gap-3 border-danger-200 p-4'
                                : 'flex flex-col gap-3 p-4'
                        }
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2">
                                <span className="shrink-0 text-body font-semibold text-neutral-500">
                                    Q{num}.
                                </span>
                                <div
                                    className="min-w-0 flex-1 break-words text-body text-neutral-700 [&_img]:my-2 [&_img]:max-h-56 [&_img]:rounded [&_img]:border [&_img]:border-neutral-200"
                                    // Generated question HTML. The only markup the generator can
                                    // emit is text plus <img> tags whose src we substituted
                                    // ourselves from our own S3 — the model never sees a URL, so
                                    // it cannot inject one.
                                    dangerouslySetInnerHTML={{
                                        __html: raw.question?.content ?? '',
                                    }}
                                />
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {meta.marks != null && (
                                    <span className="text-caption text-neutral-500">
                                        {meta.marks} mark{meta.marks === 1 ? '' : 's'}
                                    </span>
                                )}
                                {errors.length > 0 ? (
                                    <StatusChip
                                        status="DANGER"
                                        text="Needs fixing"
                                        textSize="text-caption"
                                        showIcon={false}
                                    />
                                ) : warnings.length > 0 ? (
                                    <StatusChip
                                        status="WARNING"
                                        text="Check"
                                        textSize="text-caption"
                                        showIcon={false}
                                    />
                                ) : (
                                    <CheckCircle className="size-4 text-success-600" />
                                )}
                            </div>
                        </div>

                        {(raw.options?.length ?? 0) > 0 && (
                            <ol className="ml-8 flex flex-col gap-1">
                                {raw.options?.map((opt, oi) => {
                                    const correct = (raw.correct_options ?? []).includes(
                                        String(opt.preview_id ?? oi + 1)
                                    );
                                    return (
                                        <li
                                            key={`${opt.preview_id}-${oi}`}
                                            className={
                                                correct
                                                    ? 'flex items-start gap-2 text-body text-success-700'
                                                    : 'flex items-start gap-2 text-body text-neutral-600'
                                            }
                                        >
                                            <span className="shrink-0">
                                                {String.fromCharCode(65 + oi)}.
                                            </span>
                                            <span
                                                className="min-w-0 break-words"
                                                dangerouslySetInnerHTML={{
                                                    __html: opt.content ?? '',
                                                }}
                                            />
                                            {correct && (
                                                <CheckCircle className="mt-0.5 size-3.5 shrink-0" />
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        )}

                        {raw.exp && (
                            <div className="ml-8 rounded-md border border-neutral-200 bg-neutral-50 p-2">
                                <p className="text-caption font-semibold text-neutral-600">
                                    Marking scheme
                                </p>
                                <div
                                    className="mt-0.5 break-words text-caption text-neutral-600"
                                    dangerouslySetInnerHTML={{ __html: raw.exp }}
                                />
                            </div>
                        )}

                        {issues.length > 0 && (
                            <ul className="ml-8 flex flex-col gap-0.5">
                                {issues.map((issue, ii) => (
                                    <li
                                        key={ii}
                                        className={
                                            issue.severity === 'error'
                                                ? 'text-caption text-danger-600'
                                                : 'text-caption text-warning-600'
                                        }
                                    >
                                        {issue.message}
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="ml-8 flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-caption text-neutral-500">
                                <BookOpen className="size-3.5" />
                                {meta.topic ? `${meta.topic} · ` : ''}
                                {page ? `page ${page}` : 'no page recorded'}
                                {(meta.figures?.length ?? 0) > 0 &&
                                    ` · ${meta.figures?.length} diagram from the book`}
                            </span>
                            <div className="flex items-center gap-1">
                                {openNudge === num &&
                                    NUDGES.map((n) => (
                                        <MyButton
                                            key={n.label}
                                            buttonType="secondary"
                                            scale="small"
                                            disable={busy}
                                            onClick={() => {
                                                setOpenNudge(null);
                                                onRegenerate(raw, n.instruction);
                                            }}
                                        >
                                            {n.label}
                                        </MyButton>
                                    ))}
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    disable={
                                        busy || !blueprint.rows.some((r) => r.id === meta.row_id)
                                    }
                                    onClick={() => {
                                        if (!blueprint.rows.some((r) => r.id === meta.row_id)) {
                                            toast.error(
                                                'This question’s section is no longer in the plan.'
                                            );
                                            return;
                                        }
                                        setOpenNudge(openNudge === num ? null : num);
                                    }}
                                >
                                    <ArrowClockwise
                                        className={
                                            busy ? 'mr-1 size-3.5 animate-spin' : 'mr-1 size-3.5'
                                        }
                                    />
                                    {busy ? 'Rewriting…' : 'Rewrite'}
                                </MyButton>
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
};
