import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkle, Image as ImageIcon, Trash, ArrowsClockwise } from '@phosphor-icons/react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { MyButton } from '@/components/design-system/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    useStudyLibraryStore,
    type SubjectType,
} from '@/stores/study-library/use-study-library-store';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useStudyLibraryQuery } from '@/routes/study-library/courses/-services/getStudyLibraryDetails';
import { handleFetchModulesWithChapters } from '@/routes/study-library/courses/-services/getModulesWithChapters';
import { fetchSlidesOnly } from '@/routes/study-library/courses/-services/getAllSlides';
import { createEngagementPlan } from '../-services/engagement-service';
import {
    countImagePlaceholders,
    draftAiPlan,
    illustrateReading,
    newIdempotencyKey,
    DRAFT_CREDITS,
    IMAGE_CREDITS,
    ITEM_CREDITS,
    type AiPlanBrief,
    type AiPlanDraft,
} from '../-services/ai-plan-service';
import type { EngagementItemRequest, EngagementSlotRequest } from '../-types/types';
import { BatchPickerDialog, type BatchOption } from './BatchPickerDialog';
import { PlanPreview, type PreviewTask } from './PlanPreview';

type Step = 'brief' | 'generating' | 'review';

const DURATIONS = [
    { days: 1, label: 'Today' },
    { days: 7, label: 'A week' },
    { days: 14, label: 'Two weeks' },
    { days: 30, label: 'A month' },
];

interface ChapterLike {
    id: string;
    chapter_name?: string;
    chapter_dto?: { id: string; chapter_name?: string };
}
interface ModuleLike {
    module: { id: string; module_name?: string };
    chapters: ChapterLike[];
}
interface SlideLike {
    id: string;
    title?: string;
    document_slide?: { data?: string | null; published_data?: string | null } | null;
}

/**
 * Plan with AI.
 *
 * Brief → one draft → review → publish. The teacher sees every task before a
 * learner does; the AI never publishes. Cost is shown before it is spent: a draft
 * is a flat charge, and pictures for a reading are a separate, per-picture choice.
 */
export function AiPlanWizard({
    open,
    onOpenChange,
    onCreated,
    defaultPackageSessionId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: () => void;
    defaultPackageSessionId?: string;
}) {
    const [step, setStep] = useState<Step>('brief');
    const [error, setError] = useState<string | null>(null);

    // Brief
    const [batches, setBatches] = useState<BatchOption[]>([]);
    const [batchPickerOpen, setBatchPickerOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [topic, setTopic] = useState('');
    const [days, setDays] = useState(7);
    const [perDay, setPerDay] = useState(2);
    const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [startTime, setStartTime] = useState('06:00');
    const [endTime, setEndTime] = useState('20:00');
    const [revealTime, setRevealTime] = useState('20:00');
    const [difficulty, setDifficulty] = useState<AiPlanBrief['difficulty']>('medium');
    const [language, setLanguage] = useState('English');
    const [mix, setMix] = useState({
        question_of_day: true,
        text_question: false,
        poll: false,
        reading: true,
        game: false,
    });
    // Grounding: chapters picked from the batch's course
    const [subjectId, setSubjectId] = useState('');
    const [chapterIds, setChapterIds] = useState<string[]>([]);

    // Draft + review
    const [draft, setDraft] = useState<AiPlanDraft | null>(null);
    // One key per draft attempt; a retry of the SAME attempt reuses it so it cannot
    // be billed twice. Reset when the brief changes.
    const [draftKey, setDraftKey] = useState(() => newIdempotencyKey('engagement-draft'));
    const [selectedDay, setSelectedDay] = useState(0);
    const [illustrating, setIllustrating] = useState<string | null>(null);
    const [regenerating, setRegenerating] = useState<string | null>(null);
    // Kept from the last draft so a single-task regeneration is grounded the same way.
    const [lastGrounding, setLastGrounding] = useState<{ title?: string; text: string }[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setStep('brief');
        setError(null);
        setDraft(null);
        if (defaultPackageSessionId)
            setBatches([{ id: defaultPackageSessionId, label: 'This batch' }]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Subjects for the first selected batch, same derivation the slide picker uses.
    const { studyLibraryData } = useStudyLibraryStore();
    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();
    const studyLibraryQuery = useStudyLibraryQuery();
    useQuery({ ...studyLibraryQuery, enabled: open && batches.length > 0 });

    const subjects: SubjectType[] = useMemo(() => {
        const ps = batches[0]?.id;
        if (!ps) return [];
        const details = getDetailsFromPackageSessionId({ packageSessionId: ps });
        const course = studyLibraryData?.find((c) => c.course.id === details?.package_dto?.id);
        const session = course?.sessions.find((s) => s.session_dto.id === details?.session?.id);
        const level = session?.level_with_details.find((l) => l.id === details?.level?.id);
        return level?.subjects ?? [];
    }, [batches, studyLibraryData, getDetailsFromPackageSessionId]);

    const modulesQuery = useQuery({
        ...handleFetchModulesWithChapters(subjectId, batches[0]?.id ?? ''),
        enabled: open && Boolean(subjectId) && Boolean(batches[0]?.id),
    });
    const modules = useMemo(() => (modulesQuery.data as ModuleLike[]) ?? [], [modulesQuery.data]);
    const chapters = useMemo(
        () =>
            modules.flatMap((m) =>
                (m.chapters ?? []).map((c) => ({
                    id: c.chapter_dto?.id ?? c.id,
                    name: `${m.module.module_name ?? 'Module'} · ${c.chapter_dto?.chapter_name ?? c.chapter_name ?? 'Chapter'}`,
                }))
            ),
        [modules]
    );

    const enabledCount = Object.values(mix).filter(Boolean).length;

    async function collectGrounding(): Promise<{ title?: string; text: string }[]> {
        // Pull the chosen chapters' slide HTML; the service strips and caps it.
        const out: { title?: string; text: string }[] = [];
        for (const chapterId of chapterIds) {
            try {
                const slides = (await fetchSlidesOnly(chapterId)) as SlideLike[];
                for (const s of slides ?? []) {
                    const html = s.document_slide?.published_data || s.document_slide?.data || '';
                    if (html && html.length > 40) out.push({ title: s.title, text: html });
                }
            } catch {
                // A chapter that fails to load just contributes nothing.
            }
        }
        return out;
    }

    async function generate() {
        if (batches.length === 0) return setError('Pick at least one batch.');
        if (!topic.trim() && chapterIds.length === 0) {
            return setError('Say what to cover, or pick some chapters.');
        }
        if (enabledCount === 0) return setError('Turn on at least one task type.');
        setError(null);
        setStep('generating');
        try {
            const grounding_texts = await collectGrounding();
            setLastGrounding(grounding_texts);
            const result = await draftAiPlan(
                {
                    title: title.trim() || undefined,
                    topic: topic.trim() || undefined,
                    language,
                    difficulty,
                    start_date: startDate,
                    days,
                    per_day_items: perDay,
                    start_time: startTime,
                    end_time: endTime,
                    reveal_time: revealTime || undefined,
                    notify_time: startTime,
                    completion_points: 10,
                    correct_points: 20,
                    mix,
                    grounding_texts,
                },
                draftKey
            );
            // Success: the next draft is a new attempt and gets a new key.
            setDraftKey(newIdempotencyKey('engagement-draft'));
            setDraft(result);
            setSelectedDay(0);
            setStep('review');
        } catch (e: unknown) {
            const message =
                (e as { response?: { data?: { detail?: string; message?: string } } })?.response
                    ?.data?.detail ??
                (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'The AI could not draft this plan just now.';
            setError(message);
            setStep('brief');
        }
    }

    function patchItem(
        slotIndex: number,
        itemIndex: number,
        patch: Partial<EngagementItemRequest>
    ) {
        setDraft((prev) => {
            if (!prev) return prev;
            const slots = prev.slots.map((s, si) =>
                si !== slotIndex
                    ? s
                    : {
                          ...s,
                          items: (s.items ?? []).map((it, ii) =>
                              ii === itemIndex ? { ...it, ...patch } : it
                          ),
                      }
            );
            return { ...prev, slots };
        });
    }

    function removeItem(slotIndex: number, itemIndex: number) {
        setDraft((prev) => {
            if (!prev) return prev;
            const slots = prev.slots
                .map((s, si) =>
                    si !== slotIndex
                        ? s
                        : { ...s, items: (s.items ?? []).filter((_, ii) => ii !== itemIndex) }
                )
                .filter((s) => (s.items ?? []).length > 0);
            return { ...prev, slots };
        });
    }

    async function addPictures(slotIndex: number, itemIndex: number) {
        const item = draft?.slots[slotIndex]?.items?.[itemIndex];
        if (!item?.contentHtml) return;
        const key = `${slotIndex}-${itemIndex}`;
        setIllustrating(key);
        setError(null);
        try {
            const res = await illustrateReading(
                item.title,
                item.contentHtml,
                newIdempotencyKey(`engagement-illustrate-${slotIndex}-${itemIndex}`),
                2
            );
            patchItem(slotIndex, itemIndex, {
                contentHtml: res.content_html,
                itemType: res.images_generated > 0 ? 'VISUAL_NOTE' : item.itemType,
            });
        } catch (e: unknown) {
            setError(
                (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                    'Could not generate the pictures.'
            );
        } finally {
            setIllustrating(null);
        }
    }

    /** Replace one task with a fresh one of the same kind — a small call, not a re-draft. */
    async function regenerate(slotIndex: number, itemIndex: number) {
        const slot = draft?.slots[slotIndex];
        const item = slot?.items?.[itemIndex];
        if (!slot || !item) return;
        const key = `${slotIndex}-${itemIndex}`;
        setRegenerating(key);
        setError(null);
        try {
            let single: string = item.itemType;
            if (item.itemType === 'QUESTION_OF_DAY') {
                try {
                    const fmt = (JSON.parse(item.payloadJson ?? '{}') as { format?: string })
                        .format;
                    if (fmt === 'TEXT') single = 'TEXT_QUESTION';
                } catch {
                    // keep MCQ
                }
            }
            const res = await draftAiPlan(
                {
                    topic: `${topic.trim()}\nDay theme: ${slot.title ?? ''}`.trim() || undefined,
                    language,
                    difficulty,
                    start_date: slot.startDate,
                    days: 1,
                    per_day_items: 1,
                    start_time: startTime,
                    end_time: endTime,
                    reveal_time: revealTime || undefined,
                    notify_time: startTime,
                    completion_points: item.completionPoints ?? 10,
                    correct_points: item.correctPoints ?? 20,
                    mix,
                    grounding_texts: lastGrounding,
                    single_item_type: single,
                    avoid_title: item.title,
                },
                newIdempotencyKey(`engagement-item-${slotIndex}-${itemIndex}`)
            );
            const fresh = res.slots[0]?.items?.[0];
            if (!fresh) throw new Error('empty');
            setDraft((prev) => {
                if (!prev) return prev;
                const slots = prev.slots.map((s, si) =>
                    si !== slotIndex
                        ? s
                        : {
                              ...s,
                              items: (s.items ?? []).map((it, ii) =>
                                  ii === itemIndex ? fresh : it
                              ),
                          }
                );
                return { ...prev, slots };
            });
        } catch (e: unknown) {
            setError(
                (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                    'Could not regenerate that task.'
            );
        } finally {
            setRegenerating(null);
        }
    }

    async function publish(status: 'PUBLISHED' | 'DRAFT') {
        if (!draft) return;
        setSaving(true);
        setError(null);
        try {
            await createEngagementPlan({
                title: draft.title,
                description: topic.trim() || undefined,
                packageSessionIds: batches.map((b) => b.id),
                status,
                defaultMissPolicy: 'CATCH_UP_REDUCED',
                defaultCatchUpDays: 2,
                defaultCatchUpPercent: 50,
                slots: draft.slots as EngagementSlotRequest[],
            });
            onCreated();
            onOpenChange(false);
        } catch (e: unknown) {
            setError(
                (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                    'Could not save the plan.'
            );
        } finally {
            setSaving(false);
        }
    }

    const previewTasks: PreviewTask[] = useMemo(() => {
        const slot = draft?.slots[selectedDay];
        return (slot?.items ?? []).map((it, i) => {
            let parsed: {
                prompt?: string;
                options?: { id: string; text: string }[];
                correctOptionId?: string;
                explanation?: string;
            } = {};
            try {
                parsed = it.payloadJson ? JSON.parse(it.payloadJson) : {};
            } catch {
                parsed = {};
            }
            return {
                key: `${selectedDay}-${i}`,
                itemType: it.itemType,
                title: it.title,
                isRequired: it.isRequired,
                contentHtml: it.contentHtml,
                prompt: parsed.prompt,
                options: parsed.options,
                correctOptionId: parsed.correctOptionId,
                explanation: parsed.explanation,
                completionPoints: it.completionPoints,
                correctPoints: it.correctPoints,
            };
        });
    }, [draft, selectedDay]);

    const totalItems = draft?.slots.reduce((n, s) => n + (s.items?.length ?? 0), 0) ?? 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-screen w-full overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-start">
                        <Sparkle size={18} className="text-primary-500" />
                        {step === 'review' ? 'Review the plan' : 'Plan with AI'}
                    </DialogTitle>
                </DialogHeader>

                {step === 'brief' && (
                    <div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Batches</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 w-full justify-start font-normal"
                                    onClick={() => setBatchPickerOpen(true)}
                                >
                                    {batches.length === 0
                                        ? 'Select batches'
                                        : batches.length === 1
                                          ? batches[0]!.label
                                          : `${batches.length} batches selected`}
                                </Button>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="ai-title">Plan title (optional)</Label>
                                <Input
                                    id="ai-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="The AI will name it if you leave this blank"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="ai-topic">What should learners engage with?</Label>
                            <Textarea
                                id="ai-topic"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                rows={3}
                                placeholder="e.g. Revise Newton's laws before Friday's test — one question a day, and a short reading on the tricky bits. Keep it light on Sunday."
                            />
                        </div>

                        <div className="rounded-lg border border-neutral-200 p-4">
                            <p className="text-sm font-medium text-neutral-900">
                                Ground it in your course content
                            </p>
                            <p className="mt-0.5 text-xs text-neutral-500">
                                Pick chapters and the AI writes only from what is in them.
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Subject</Label>
                                    <Select
                                        value={subjectId}
                                        disabled={batches.length === 0}
                                        onValueChange={(v) => {
                                            setSubjectId(v);
                                            setChapterIds([]);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue
                                                placeholder={
                                                    batches.length === 0
                                                        ? 'Pick a batch first'
                                                        : 'Select a subject'
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {subjects.map((s) => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    {s.subject_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Chapters</Label>
                                    <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
                                        {chapters.length === 0 && (
                                            <p className="px-1 py-2 text-xs text-neutral-500">
                                                {subjectId
                                                    ? 'Loading chapters…'
                                                    : 'Pick a subject to see chapters.'}
                                            </p>
                                        )}
                                        {chapters.map((c) => (
                                            <label
                                                key={c.id}
                                                className="flex cursor-pointer items-center gap-2 rounded p-1 text-sm hover:bg-neutral-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={chapterIds.includes(c.id)}
                                                    onChange={(e) =>
                                                        setChapterIds((prev) =>
                                                            e.target.checked
                                                                ? [...prev, c.id]
                                                                : prev.filter((x) => x !== c.id)
                                                        )
                                                    }
                                                />
                                                <span className="truncate">{c.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-neutral-200 p-4">
                            <p className="text-sm font-medium text-neutral-900">
                                Shape of the plan
                            </p>
                            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-1.5">
                                    <Label>Duration</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {DURATIONS.map((d) => (
                                            <button
                                                key={d.days}
                                                type="button"
                                                onClick={() => setDays(d.days)}
                                                className={
                                                    days === d.days
                                                        ? 'rounded-md bg-primary-500 px-2.5 py-1 text-xs font-medium text-white'
                                                        : 'rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200'
                                                }
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-start">Starts</Label>
                                    <Input
                                        id="ai-start"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Tasks per day</Label>
                                    <div className="flex gap-1.5">
                                        {[1, 2, 3].map((n) => (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() => setPerDay(n)}
                                                className={
                                                    perDay === n
                                                        ? 'rounded-md bg-primary-500 px-3 py-1 text-xs font-medium text-white'
                                                        : 'rounded-md bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200'
                                                }
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Difficulty</Label>
                                    <Select
                                        value={difficulty}
                                        onValueChange={(v) =>
                                            setDifficulty(v as AiPlanBrief['difficulty'])
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="easy">Easy</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="hard">Hard</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-open">Opens at</Label>
                                    <Input
                                        id="ai-open"
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-close">Closes at</Label>
                                    <Input
                                        id="ai-close"
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-reveal">Reveal answers at</Label>
                                    <Input
                                        id="ai-reveal"
                                        type="time"
                                        value={revealTime}
                                        onChange={(e) => setRevealTime(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-lang">Language</Label>
                                    <Input
                                        id="ai-lang"
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 space-y-1.5">
                                <Label>Kinds of task</Label>
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {(
                                        [
                                            [
                                                'question_of_day',
                                                'Question of the day',
                                                'Multiple choice, graded, answer at reveal',
                                            ],
                                            [
                                                'text_question',
                                                'Written question',
                                                'A short reflective answer you read',
                                            ],
                                            ['poll', 'Poll', 'Opinion, no right answer'],
                                            [
                                                'reading',
                                                'Reading',
                                                'A short explainer; add pictures later',
                                            ],
                                            [
                                                'game',
                                                'Flashcard game',
                                                'Terms and definitions to flip through',
                                            ],
                                        ] as const
                                    ).map(([key, label, hint]) => (
                                        <label
                                            key={key}
                                            className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3"
                                        >
                                            <Switch
                                                checked={mix[key]}
                                                onCheckedChange={(v) =>
                                                    setMix((m) => ({ ...m, [key]: v }))
                                                }
                                            />
                                            <span>
                                                <span className="block text-sm font-medium text-neutral-900">
                                                    {label}
                                                </span>
                                                <span className="block text-xs text-neutral-500">
                                                    {hint}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {error && (
                            <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
                                {error}
                            </p>
                        )}
                    </div>
                )}

                {step === 'generating' && (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <Sparkle size={36} className="animate-pulse text-primary-500" />
                        <p className="text-sm font-medium text-neutral-900">
                            Drafting {days} day{days === 1 ? '' : 's'} of tasks…
                        </p>
                        <p className="max-w-md text-xs text-neutral-500">
                            One pass writes every question, reading and game. You review all of it
                            before any learner sees anything.
                        </p>
                    </div>
                )}

                {step === 'review' && draft && (
                    <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)_20rem]">
                        {/* Days */}
                        <div className="space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                {draft.days_planned} days · {totalItems} tasks
                            </p>
                            {draft.slots.map((slot, i) => (
                                <button
                                    key={slot.startDate + i}
                                    type="button"
                                    onClick={() => setSelectedDay(i)}
                                    className={
                                        selectedDay === i
                                            ? 'w-full rounded-lg border border-primary-300 bg-primary-50 px-3 py-2 text-start'
                                            : 'w-full rounded-lg border border-neutral-200 px-3 py-2 text-start hover:border-neutral-300'
                                    }
                                >
                                    <span className="block text-xs text-neutral-500">
                                        {slot.startDate}
                                    </span>
                                    <span className="block truncate text-sm font-medium text-neutral-900">
                                        {slot.title}
                                    </span>
                                    <span className="block text-xs text-neutral-500">
                                        {(slot.items ?? []).length} task
                                        {(slot.items ?? []).length === 1 ? '' : 's'}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Tasks for the selected day */}
                        <div className="space-y-3">
                            {!draft.grounded && (
                                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    This draft was written from the topic alone, not from your
                                    course content. Check facts before publishing.
                                </p>
                            )}
                            {(draft.slots[selectedDay]?.items ?? []).map((item, ii) => {
                                const placeholders = countImagePlaceholders(item.contentHtml);
                                const key = `${selectedDay}-${ii}`;
                                return (
                                    <div
                                        key={key}
                                        className="space-y-2 rounded-lg border border-neutral-200 p-3"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                                                    {item.itemType}
                                                </span>
                                                <Input
                                                    value={item.title}
                                                    onChange={(e) =>
                                                        patchItem(selectedDay, ii, {
                                                            title: e.target.value,
                                                        })
                                                    }
                                                    className="mt-1"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                aria-label="Remove task"
                                                className="text-neutral-400 hover:text-danger-600"
                                                onClick={() => removeItem(selectedDay, ii)}
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={regenerating === key}
                                            onClick={() => regenerate(selectedDay, ii)}
                                        >
                                            <ArrowsClockwise size={14} />
                                            {regenerating === key
                                                ? 'Regenerating…'
                                                : `Regenerate (~${ITEM_CREDITS} credits)`}
                                        </Button>
                                        {placeholders > 0 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={illustrating === key}
                                                onClick={() => addPictures(selectedDay, ii)}
                                            >
                                                <ImageIcon size={14} />
                                                {illustrating === key
                                                    ? 'Generating pictures…'
                                                    : `Add ${Math.min(placeholders, 2)} picture${Math.min(placeholders, 2) === 1 ? '' : 's'} (~${Math.min(placeholders, 2) * IMAGE_CREDITS} credits)`}
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                            {error && (
                                <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
                                    {error}
                                </p>
                            )}
                        </div>

                        {/* Learner preview */}
                        <aside className="lg:sticky lg:top-0 lg:self-start">
                            <PlanPreview
                                tasks={previewTasks}
                                startTime={startTime}
                                endTime={endTime}
                                revealTime={revealTime}
                                missPolicy="CATCH_UP_REDUCED"
                                catchUpPercent={50}
                            />
                        </aside>
                    </div>
                )}

                <DialogFooter className="items-center gap-3 sm:justify-between">
                    {step === 'brief' && (
                        <>
                            <p className="text-xs text-neutral-500">
                                Drafting costs ~{DRAFT_CREDITS} credits. Pictures are extra, only if
                                you add them.
                            </p>
                            <MyButton type="button" onClick={generate}>
                                <Sparkle size={16} /> Draft the plan
                            </MyButton>
                        </>
                    )}
                    {step === 'review' && (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep('brief')}
                            >
                                Back to brief
                            </Button>
                            <span className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={saving}
                                    onClick={() => publish('DRAFT')}
                                >
                                    Save as draft
                                </Button>
                                <MyButton
                                    type="button"
                                    disable={saving || totalItems === 0}
                                    onClick={() => publish('PUBLISHED')}
                                >
                                    {saving
                                        ? 'Publishing…'
                                        : `Publish to ${batches.length} batch${batches.length === 1 ? '' : 'es'}`}
                                </MyButton>
                            </span>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>

            <BatchPickerDialog
                open={batchPickerOpen}
                onOpenChange={setBatchPickerOpen}
                selected={batches}
                onConfirm={(next) => {
                    setBatches(next);
                    setSubjectId('');
                    setChapterIds([]);
                }}
            />
        </Dialog>
    );
}
