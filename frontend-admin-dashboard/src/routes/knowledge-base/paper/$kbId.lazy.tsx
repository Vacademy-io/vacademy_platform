import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    ArrowLeft,
    CheckCircle,
    Coins,
    FloppyDisk,
    ListChecks,
    PaperPlaneTilt,
    Sparkle,
    Spinner,
    WarningCircle,
} from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useKnowledgeBase } from '../-hooks';
import { getTopics, rebuildTopics } from '../-services/paper-service';
import {
    buildBlueprint,
    getGeneration,
    markGenerationSaved,
    getPaperJob,
    regenerateQuestion,
    savePaperToQuestionBank,
    startGeneration,
    validatePaper,
} from '../-services/paper-service';
import { BlueprintTable } from '../-components/paper/BlueprintTable';
import { TopicPicker, toSelectedNodeIds } from '../-components/paper/TopicPicker';
import { ReviewBoard } from '../-components/paper/ReviewBoard';
import type {
    Blueprint,
    KbTopic,
    CreditEstimate,
    PaperIssue,
    PaperResult,
    PaperSpec,
    RawPaperQuestion,
} from '../-types/paper';

export const Route = createLazyFileRoute('/knowledge-base/paper/$kbId')({
    component: PaperBuilderPage,
});

type Step = 'scope' | 'blueprint' | 'generating' | 'review';

const POLL_MS = 3000;

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'MIXED'];

function errorMessage(error: unknown, fallback: string): string {
    const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })
        ?.response;
    const detail = response?.data?.detail;
    if (response?.status === 402) {
        if (detail && typeof detail === 'object' && 'message' in detail) {
            return String((detail as { message: unknown }).message);
        }
        return 'Not enough credits.';
    }
    return typeof detail === 'string' ? detail : fallback;
}

function StepHeader({ step }: { step: Step }) {
    const steps: Array<{ key: Step; label: string }> = [
        { key: 'scope', label: 'Choose material' },
        { key: 'blueprint', label: 'Plan the paper' },
        { key: 'review', label: 'Review questions' },
    ];
    const activeIndex = step === 'generating' ? 1 : steps.findIndex((s) => s.key === step);
    return (
        <div className="flex flex-wrap items-center gap-2">
            {steps.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2">
                    <span
                        className={
                            i <= activeIndex
                                ? 'flex items-center gap-1.5 text-caption font-semibold text-primary-500'
                                : 'flex items-center gap-1.5 text-caption text-neutral-400'
                        }
                    >
                        <span
                            className={
                                i < activeIndex
                                    ? 'flex size-5 items-center justify-center rounded-full bg-primary-500 text-caption text-white'
                                    : i === activeIndex
                                      ? 'flex size-5 items-center justify-center rounded-full border border-primary-500 text-caption text-primary-500'
                                      : 'flex size-5 items-center justify-center rounded-full border border-neutral-300 text-caption text-neutral-400'
                            }
                        >
                            {i < activeIndex ? '✓' : i + 1}
                        </span>
                        {s.label}
                    </span>
                    {i < steps.length - 1 && <span className="text-neutral-300">→</span>}
                </div>
            ))}
        </div>
    );
}

function PaperBuilderPage() {
    const { kbId } = Route.useParams();
    const { resume } = Route.useSearch();
    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();
    const { data: kb } = useKnowledgeBase(kbId);

    const [step, setStep] = useState<Step>('scope');
    const [topics, setTopics] = useState<KbTopic[] | null>(null);
    const [selectedLeafIds, setSelectedLeafIds] = useState<Set<string>>(new Set());
    const [rebuilding, setRebuilding] = useState(false);

    const [spec, setSpec] = useState<PaperSpec>({
        total_questions: 20,
        duration_minutes: 90,
        difficulty: 'MIXED',
        grade: '',
    });

    const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
    const [estimate, setEstimate] = useState<CreditEstimate | null>(null);
    const [planning, setPlanning] = useState(false);
    const [refineText, setRefineText] = useState('');

    const [taskId, setTaskId] = useState<string | null>(null);
    const [result, setResult] = useState<PaperResult | null>(null);
    const [issues, setIssues] = useState<PaperIssue[]>([]);
    const [regenNumber, setRegenNumber] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [generationId, setGenerationId] = useState<string | null>(null);
    const [resuming, setResuming] = useState(Boolean(resume));

    useEffect(() => {
        setNavHeading('Create question paper');
    }, [setNavHeading]);

    // Reopen a previous run: its plan always, its questions when it produced
    // any. A FAILED run lands back on the blueprint so it can simply be re-run.
    useEffect(() => {
        if (!resume) return;
        let cancelled = false;
        getGeneration(resume)
            .then((record) => {
                if (cancelled) return;
                setGenerationId(record.id);
                if (record.input?.blueprint) setBlueprint(record.input.blueprint);
                if (record.input?.grade) {
                    setSpec((prev) => ({ ...prev, grade: String(record.input.grade) }));
                }
                if (record.result?.questions?.length) {
                    setResult(record.result);
                    setIssues(record.result.issues ?? []);
                    setStep('review');
                } else if (record.input?.blueprint) {
                    setStep('blueprint');
                }
            })
            .catch(() => toast.error('Could not reopen that paper'))
            .finally(() => !cancelled && setResuming(false));
        return () => {
            cancelled = true;
        };
    }, [resume]);

    useEffect(() => {
        getTopics(kbId)
            .then(setTopics)
            .catch(() => setTopics([]));
    }, [kbId]);

    // A selected topic implies all of its subtopics, so this collapses to the
    // parent id where the whole topic is chosen — see toSelectedNodeIds.
    const selectedNodeIds = useMemo(
        () => toSelectedNodeIds(topics ?? [], selectedLeafIds),
        [topics, selectedLeafIds]
    );

    const handleRebuildTopics = async () => {
        setRebuilding(true);
        try {
            setTopics(await rebuildTopics(kbId));
            toast.success('Topic map rebuilt');
        } catch (error) {
            toast.error(errorMessage(error, 'Could not rebuild the topic map'));
        } finally {
            setRebuilding(false);
        }
    };

    // ---- Plan -------------------------------------------------------------
    const plan = useCallback(
        async (instruction?: string) => {
            setPlanning(true);
            try {
                const response = await buildBlueprint(kbId, {
                    spec,
                    selected_node_ids: selectedNodeIds.length ? selectedNodeIds : undefined,
                    current_blueprint: instruction ? blueprint ?? undefined : undefined,
                    instruction,
                });
                setBlueprint(response.blueprint);
                setEstimate(response.generation_estimate);
                setStep('blueprint');
                setRefineText('');
            } catch (error) {
                toast.error(errorMessage(error, 'Could not plan the paper'));
            } finally {
                setPlanning(false);
            }
        },
        [kbId, spec, selectedNodeIds, blueprint]
    );

    // ---- Generate ---------------------------------------------------------
    const generate = async () => {
        if (!blueprint) return;
        try {
            const { task_id } = await startGeneration(kbId, {
                blueprint,
                grade: spec.grade || undefined,
            });
            setTaskId(task_id);
            // A fresh run supersedes whatever we resumed from.
            setGenerationId(null);
            setStep('generating');
        } catch (error) {
            toast.error(errorMessage(error, 'Could not start generating'));
        }
    };

    useEffect(() => {
        if (step !== 'generating' || !taskId) return;
        let cancelled = false;
        const tick = async () => {
            try {
                const job = await getPaperJob(taskId);
                if (cancelled) return;
                if (job.status === 'COMPLETED' && job.result) {
                    setResult(job.result);
                    setIssues(job.result.issues);
                    setStep('review');
                    return;
                }
                if (job.status === 'FAILED') {
                    toast.error(job.status_message || 'Generation failed');
                    setStep('blueprint');
                    return;
                }
                setTimeout(tick, POLL_MS);
            } catch {
                if (!cancelled) setTimeout(tick, POLL_MS);
            }
        };
        const handle = setTimeout(tick, POLL_MS);
        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [step, taskId]);

    // ---- Regenerate one ---------------------------------------------------
    const regenerate = async (raw: RawPaperQuestion, instruction?: string) => {
        if (!blueprint || !result) return;
        const rowId = raw.kb_meta?.row_id;
        const row = blueprint.rows.find((r) => r.id === rowId);
        if (!row) {
            toast.error('This question’s section is no longer in the plan.');
            return;
        }
        const num = raw.question_number ?? 0;
        setRegenNumber(num);
        try {
            const { raw_question, question } = await regenerateQuestion(kbId, {
                blueprint_row: row,
                instruction,
                grade: spec.grade || undefined,
            });
            // Keep the original position and number so the paper's order is stable.
            const replacement: RawPaperQuestion = {
                ...raw_question,
                question_number: num,
                kb_meta: { ...(raw_question.kb_meta ?? {}), row_id: row.id },
            };
            const rawQuestions = result.raw_questions.map((q) =>
                (q.question_number ?? 0) === num ? replacement : q
            );
            const questions = result.questions.map((q, i) =>
                (result.raw_questions[i]?.question_number ?? 0) === num ? question : q
            );
            const next = { ...result, raw_questions: rawQuestions, questions };
            setResult(next);
            // Re-validate: a rewritten question can introduce a duplicate that
            // did not exist before.
            try {
                const revalidated = await validatePaper(kbId, {
                    blueprint,
                    questions: rawQuestions,
                });
                setIssues(revalidated.issues);
            } catch {
                /* keep the previous issues rather than clearing them */
            }
            toast.success('Question rewritten');
        } catch (error) {
            toast.error(errorMessage(error, 'Could not rewrite that question'));
        } finally {
            setRegenNumber(null);
        }
    };

    // ---- Save -------------------------------------------------------------
    const save = async () => {
        if (!result || !blueprint) return;
        setSaving(true);
        try {
            const saved = await savePaperToQuestionBank({
                title: blueprint.title,
                questions: result.questions,
            });
            // Best-effort: the paper IS saved either way, and failing to update
            // history must not make it look like the save failed.
            if (generationId) {
                await markGenerationSaved(generationId, saved?.saved_question_paper_id).catch(
                    () => undefined
                );
            }
            toast.success('Saved to your question bank');
            navigate({ to: '/assessment/question-papers' });
        } catch (error) {
            toast.error(errorMessage(error, 'Could not save the paper'));
        } finally {
            setSaving(false);
        }
    };

    const issuesByQuestion = useMemo(() => {
        const map = new Map<number, PaperIssue[]>();
        issues.forEach((i) => {
            if (i.question_number == null) return;
            map.set(i.question_number, [...(map.get(i.question_number) ?? []), i]);
        });
        return map;
    }, [issues]);

    const paperLevelIssues = issues.filter((i) => i.question_number == null);
    const errorCount = issues.filter((i) => i.severity === 'error').length;

    return (
        <LayoutContainer>
            <Helmet>
                <title>Create question paper</title>
            </Helmet>

            <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <MyButton
                        buttonType="text"
                        scale="medium"
                        onClick={() => navigate({ to: '/knowledge-base/$kbId', params: { kbId } })}
                        className="w-fit"
                    >
                        <ArrowLeft className="mr-1 size-4" />
                        {kb?.name ?? 'Knowledge base'}
                    </MyButton>
                    <StepHeader step={step} />
                </div>

                {/* Reopening a saved run: hold the step UI until its plan lands,
                    otherwise the scope form flashes before being replaced. */}
                {resuming && (
                    <Card className="flex flex-col items-center gap-3 p-12 text-center">
                        <Spinner className="size-6 animate-spin text-primary-500" />
                        <p className="text-body text-neutral-600">Reopening your paper…</p>
                    </Card>
                )}

                {/* ---------------- Step 1: scope + intake ---------------- */}
                {!resuming && step === 'scope' && (
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="flex flex-col gap-3 p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-subtitle font-semibold text-neutral-700">
                                        What should the paper cover?
                                    </p>
                                    <p className="text-caption text-neutral-500">
                                        The topics found across everything in this knowledge base.
                                        Pick a topic to include all of it, or open it to choose
                                        subtopics. Leave everything unticked to draw from the whole
                                        knowledge base.
                                    </p>
                                </div>
                                {topics !== null && topics.length > 0 && (
                                    <MyButton
                                        buttonType="text"
                                        scale="medium"
                                        onClick={handleRebuildTopics}
                                        disable={rebuilding}
                                    >
                                        {rebuilding ? 'Rebuilding…' : 'Rebuild'}
                                    </MyButton>
                                )}
                            </div>

                            {topics === null && <Skeleton className="h-40 w-full rounded-md" />}
                            {topics !== null && topics.length === 0 && (
                                <div className="flex flex-col items-start gap-2">
                                    <p className="text-body text-neutral-500">
                                        No topic map yet. It is built automatically once a document
                                        finishes processing.
                                    </p>
                                    <MyButton
                                        buttonType="secondary"
                                        scale="medium"
                                        onClick={handleRebuildTopics}
                                        disable={rebuilding}
                                    >
                                        {rebuilding ? 'Building…' : 'Build the topic map'}
                                    </MyButton>
                                </div>
                            )}
                            {topics !== null && topics.length > 0 && (
                                <TopicPicker
                                    topics={topics}
                                    selectedLeafIds={selectedLeafIds}
                                    onChange={setSelectedLeafIds}
                                />
                            )}
                        </Card>

                        <Card className="flex flex-col gap-4 p-4">
                            <p className="text-subtitle font-semibold text-neutral-700">
                                What kind of paper?
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <MyInput
                                    label="Number of questions"
                                    inputType="number"
                                    input={String(spec.total_questions ?? '')}
                                    onChangeFunction={(e) =>
                                        setSpec({
                                            ...spec,
                                            total_questions: Number(e.target.value),
                                        })
                                    }
                                    inputPlaceholder="20"
                                    className="w-full"
                                />
                                <MyInput
                                    label="Duration (minutes)"
                                    inputType="number"
                                    input={String(spec.duration_minutes ?? '')}
                                    onChangeFunction={(e) =>
                                        setSpec({
                                            ...spec,
                                            duration_minutes: Number(e.target.value),
                                        })
                                    }
                                    inputPlaceholder="90"
                                    className="w-full"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-subtitle font-regular text-neutral-600">
                                    Overall difficulty
                                </span>
                                <Select
                                    value={spec.difficulty}
                                    onValueChange={(v) => setSpec({ ...spec, difficulty: v })}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DIFFICULTIES.map((d) => (
                                            <SelectItem key={d} value={d}>
                                                {d.charAt(0) + d.slice(1).toLowerCase()}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <MyInput
                                label="Class or level"
                                inputType="text"
                                input={spec.grade ?? ''}
                                onChangeFunction={(e) =>
                                    setSpec({ ...spec, grade: e.target.value })
                                }
                                inputPlaceholder="e.g. Class 9"
                                className="w-full"
                            />
                            <MyInput
                                label="Follow a pattern (optional)"
                                inputType="text"
                                input={spec.exam_style ?? ''}
                                onChangeFunction={(e) =>
                                    setSpec({ ...spec, exam_style: e.target.value })
                                }
                                inputPlaceholder="e.g. CBSE board pattern"
                                className="w-full"
                            />

                            <MyButton
                                buttonType="primary"
                                scale="large"
                                onClick={() => void plan()}
                                disable={planning}
                            >
                                {planning ? (
                                    <>
                                        <Spinner className="mr-1 size-4 animate-spin" />
                                        Planning…
                                    </>
                                ) : (
                                    <>
                                        <ListChecks className="mr-1 size-4" />
                                        Plan the paper
                                    </>
                                )}
                            </MyButton>
                            <p className="text-caption text-neutral-400">
                                You will see the full plan and can change it before any question is
                                written.
                            </p>
                        </Card>
                    </div>
                )}

                {/* ---------------- Step 2: blueprint ---------------- */}
                {!resuming && step === 'blueprint' && blueprint && (
                    <div className="flex flex-col gap-4">
                        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                            <div className="min-w-0">
                                <p className="truncate text-subtitle font-semibold text-neutral-700">
                                    {blueprint.title}
                                </p>
                                <p className="text-caption text-neutral-500">
                                    {blueprint.total_questions} questions ·{' '}
                                    {blueprint.total_marks.toLocaleString('en-IN')} marks
                                    {blueprint.duration_minutes
                                        ? ` · ${blueprint.duration_minutes} min`
                                        : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    onClick={() => setStep('scope')}
                                    disable={planning}
                                >
                                    Change material
                                </MyButton>
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    onClick={generate}
                                    disable={planning || blueprint.total_questions === 0}
                                >
                                    <PaperPlaneTilt className="mr-1 size-4" />
                                    Generate {blueprint.total_questions} questions
                                    {estimate
                                        ? ` · ≈${Math.round(estimate.estimated_credits)} credits`
                                        : ''}
                                </MyButton>
                            </div>
                        </Card>

                        {estimate?.sufficient === false && (
                            <Card className="flex items-center gap-2 border-danger-200 bg-danger-50 p-3">
                                <Coins className="size-4 text-danger-500" />
                                <p className="text-caption text-danger-600">
                                    This needs about {Math.round(estimate.estimated_credits)}{' '}
                                    credits but only {Math.round(estimate.current_balance ?? 0)} are
                                    available.
                                </p>
                            </Card>
                        )}

                        <BlueprintTable
                            blueprint={blueprint}
                            onChange={setBlueprint}
                            disabled={planning}
                        />

                        <Card className="flex flex-col gap-2 p-4">
                            <p className="flex items-center gap-2 text-caption font-semibold text-neutral-600">
                                <Sparkle className="size-4 text-primary-500" />
                                Ask for a change
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    'Add a section of numericals',
                                    'Make section B harder',
                                    'More application-based questions',
                                ].map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        disabled={planning}
                                        onClick={() => void plan(s)}
                                        className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-caption text-neutral-600 transition-colors hover:border-primary-200 hover:bg-primary-50"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-end gap-2">
                                <MyInput
                                    label=""
                                    inputType="text"
                                    input={refineText}
                                    onChangeFunction={(e) => setRefineText(e.target.value)}
                                    inputPlaceholder="e.g. drop the long answers and add 5 more MCQs from chapter 2"
                                    className="w-full flex-1"
                                />
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    disable={planning || !refineText.trim()}
                                    onClick={() => void plan(refineText.trim())}
                                >
                                    {planning ? 'Updating…' : 'Update plan'}
                                </MyButton>
                            </div>
                        </Card>
                    </div>
                )}

                {/* ---------------- Step 3: generating ---------------- */}
                {!resuming && step === 'generating' && (
                    <Card className="flex flex-col items-center gap-3 p-12 text-center">
                        <Spinner className="size-7 animate-spin text-primary-500" />
                        <p className="text-subtitle font-semibold text-neutral-700">
                            Writing {blueprint?.total_questions ?? ''} questions from your material
                        </p>
                        <p className="max-w-md text-body text-neutral-500">
                            This usually takes a few minutes. You can leave this page — the paper
                            keeps generating and will be waiting in your question bank drafts.
                        </p>
                    </Card>
                )}

                {/* ---------------- Step 4: review ---------------- */}
                {!resuming && step === 'review' && result && blueprint && (
                    <div className="flex flex-col gap-4">
                        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                            <div className="min-w-0">
                                <p className="truncate text-subtitle font-semibold text-neutral-700">
                                    {blueprint.title}
                                </p>
                                <p className="flex flex-wrap items-center gap-x-3 text-caption text-neutral-500">
                                    <span>
                                        {result.delivered} of {result.planned} questions written
                                    </span>
                                    {errorCount > 0 ? (
                                        <span className="flex items-center gap-1 text-danger-600">
                                            <WarningCircle className="size-3.5" />
                                            {errorCount} need fixing
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-success-600">
                                            <CheckCircle className="size-3.5" />
                                            All checks passed
                                        </span>
                                    )}
                                </p>
                            </div>
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                onClick={save}
                                disable={saving || result.questions.length === 0}
                            >
                                <FloppyDisk className="mr-1 size-4" />
                                {saving ? 'Saving…' : 'Save to question bank'}
                            </MyButton>
                        </Card>

                        {(paperLevelIssues.length > 0 || result.warnings.length > 0) && (
                            <Card className="flex flex-col gap-1 border-warning-200 bg-warning-50 p-3">
                                {[
                                    ...result.warnings,
                                    ...paperLevelIssues.map((i) => i.message),
                                ].map((message) => (
                                    <p
                                        key={message}
                                        className="flex items-start gap-2 text-caption text-warning-700"
                                    >
                                        <WarningCircle className="mt-0.5 size-4 shrink-0" />
                                        {message}
                                    </p>
                                ))}
                            </Card>
                        )}

                        <ReviewBoard
                            result={result}
                            blueprint={blueprint}
                            issuesByQuestion={issuesByQuestion}
                            regeneratingNumber={regenNumber}
                            onRegenerate={regenerate}
                        />
                    </div>
                )}
            </div>
        </LayoutContainer>
    );
}
