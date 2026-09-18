import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash } from '@phosphor-icons/react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { MyButton } from '@/components/design-system/button';
import { Button } from '@/components/ui/button';
import { TipTapEditor } from '@/components/tiptap/TipTapEditor';
import {
    createEngagementPlan,
    getEngagementPlan,
    updateEngagementPlan,
} from '../-services/engagement-service';
import { PlanPreview } from './PlanPreview';
import { BatchPickerDialog, type BatchOption } from './BatchPickerDialog';
import { CourseSlidePicker, type PickedSlide } from './CourseSlidePicker';
import type {
    EngagementItemRequest,
    EngagementItemType,
    EngagementPlanRequest,
    MissPolicy,
} from '../-types/types';

/**
 * Compose one engagement plan: a batch, a window, and the items inside it.
 *
 * Times are entered as institute-local wall clock (06:00, 20:00) and stored that
 * way — the plan snapshots the institute's timezone so a later timezone change
 * cannot shift windows under learners who already attempted them.
 */

const ITEM_TYPES: { value: EngagementItemType; label: string; hint: string }[] = [
    { value: 'READING_HTML', label: 'Reading', hint: 'HTML the learner reads' },
    { value: 'VISUAL_NOTE', label: 'Visual note', hint: 'A visual explainer' },
    {
        value: 'QUESTION_OF_DAY',
        label: 'Question of the day',
        hint: 'Graded by the server',
    },
    { value: 'GAME', label: 'Game', hint: 'Your HTML, sandboxed' },
    { value: 'POLL', label: 'Poll', hint: 'No right answer' },
    {
        value: 'COURSE_SLIDE',
        label: 'Course content',
        hint: 'A lesson from this course',
    },
];

const MISS_POLICIES: { value: MissPolicy; label: string; hint: string }[] = [
    { value: 'EXPIRES', label: 'Expires', hint: 'Gone when the window closes' },
    { value: 'CATCH_UP_FULL', label: 'Catch up', hint: 'Late, still full points' },
    {
        value: 'CATCH_UP_REDUCED',
        label: 'Catch up (reduced)',
        hint: 'Late, for fewer points',
    },
];

/**
 * The message a teacher's game posts to report its result. Matches the protocol the
 * HTML slide renderer already speaks, so a game written for a slide works here
 * unchanged. Kept as a string constant because the braces read as a hex colour to
 * the design linter when written as an HTML entity.
 */
const GAME_SCORE_SNIPPET = "postMessage({ type: 'vacademy:complete', score, maxScore })";

interface DraftItem extends EngagementItemRequest {
    /** Local-only key so rows stay stable before the server assigns ids. */
    key: string;
    /** Set when the row came from a saved plan; drives update instead of insert. */
    id?: string;
    /** Chosen course slide, serialised into slideId + payloadJson on save. */
    slide?: PickedSlide;
    /** QUESTION_OF_DAY authoring, serialised into payloadJson on save. */
    prompt?: string;
    options?: { id: string; text: string }[];
    correctOptionId?: string;
    explanation?: string;
}

function newItem(): DraftItem {
    return {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        itemType: 'READING_HTML',
        title: '',
        completionPoints: 10,
        correctPoints: 0,
        isRequired: false,
        options: [
            { id: 'a', text: '' },
            { id: 'b', text: '' },
        ],
        correctOptionId: 'a',
    };
}

export function PlanComposerDialog({
    open,
    onOpenChange,
    onCreated,
    defaultPackageSessionId,
    planId,
    presetSlide,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: () => void;
    defaultPackageSessionId?: string;
    /** Present = edit an existing plan instead of creating one. */
    planId?: string | null;
    /**
     * Open with one course-content task already filled in — used by "Assign as task"
     * on a slide, so the teacher only has to choose batches and a window.
     */
    presetSlide?: PickedSlide | null;
}) {
    const isEdit = Boolean(planId);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [batches, setBatches] = useState<BatchOption[]>([]);
    const [batchPickerOpen, setBatchPickerOpen] = useState(false);
    /** Which task row is choosing a slide, by its local key. */
    const [slidePickerFor, setSlidePickerFor] = useState<string | null>(null);
    const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState('');
    const [startTime, setStartTime] = useState('06:00');
    const [endTime, setEndTime] = useState('20:00');
    const [revealTime, setRevealTime] = useState('20:00');
    const [notifyTime, setNotifyTime] = useState('06:00');
    const [missPolicy, setMissPolicy] = useState<MissPolicy>('EXPIRES');
    const [publish, setPublish] = useState(true);
    const [items, setItems] = useState<DraftItem[]>([newItem()]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [slotId, setSlotId] = useState<string | null>(null);
    const [activeKey, setActiveKey] = useState<string | null>(null);

    // Load the plan being edited and fill the form from it.
    const { data: existing } = useQuery({
        queryKey: ['engagement-plan-edit', planId],
        queryFn: () => getEngagementPlan(planId!),
        enabled: open && Boolean(planId),
    });

    useEffect(() => {
        if (!open || !existing) return;
        setTitle(existing.title ?? '');
        setDescription(existing.description ?? '');
        setMissPolicy(existing.defaultMissPolicy ?? 'EXPIRES');
        setPublish(existing.status === 'PUBLISHED');
        setBatches([{ id: existing.packageSessionId, label: 'This batch' }]);

        const slot = existing.slots?.[0];
        if (!slot) return;
        setSlotId(slot.id);
        setStartDate(slot.startDate);
        setEndDate(slot.endDate ?? '');
        setStartTime((slot.startTime ?? '06:00').slice(0, 5));
        setEndTime((slot.endTime ?? '20:00').slice(0, 5));
        setRevealTime((slot.revealTime ?? '').slice(0, 5));
        setNotifyTime((slot.notifyTime ?? '').slice(0, 5));

        setItems(
            (slot.items ?? []).map((item) => {
                // Question options and the answer key travel inside payloadJson; unpack
                // them back into the fields the form edits.
                let parsed: {
                    prompt?: string;
                    options?: { id: string; text: string }[];
                    correctOptionId?: string;
                    explanation?: string;
                } = {};
                try {
                    parsed = item.payloadJson ? JSON.parse(item.payloadJson) : {};
                } catch {
                    parsed = {};
                }
                return {
                    key: item.id,
                    id: item.id,
                    itemType: item.itemType,
                    title: item.title,
                    isRequired: item.isRequired,
                    contentHtml: item.contentHtml ?? undefined,
                    completionPoints: item.completionPoints,
                    correctPoints: item.correctPoints,
                    maxScore: item.maxScore ?? undefined,
                    slide:
                        item.itemType === 'COURSE_SLIDE' && item.slideId
                            ? ({
                                  ...(parsed as unknown as PickedSlide),
                                  slideId: item.slideId,
                              } as PickedSlide)
                            : undefined,
                    prompt: parsed.prompt ?? '',
                    options:
                        parsed.options && parsed.options.length > 0
                            ? parsed.options
                            : [
                                  { id: 'a', text: '' },
                                  { id: 'b', text: '' },
                              ],
                    correctOptionId: parsed.correctOptionId ?? 'a',
                    explanation: parsed.explanation ?? '',
                };
            })
        );
    }, [open, existing]);

    // Seed a course-content task when opened from a slide.
    useEffect(() => {
        if (!open || !presetSlide) return;
        setItems([
            {
                ...newItem(),
                itemType: 'COURSE_SLIDE',
                title: presetSlide.slideTitle,
                slide: presetSlide,
                completionPoints: 10,
                isRequired: true,
            },
        ]);
        setTitle((current) => current || presetSlide.slideTitle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, presetSlide]);

    // A batch passed in by the course page seeds the selection.
    useEffect(() => {
        if (open && defaultPackageSessionId && batches.length === 0) {
            setBatches([{ id: defaultPackageSessionId, label: 'This batch' }]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, defaultPackageSessionId]);

    // Feeds the preview straight from the form state, so it moves as the teacher types.
    const previewTasks = useMemo(
        () =>
            items.map((item) => ({
                key: item.key,
                itemType: item.itemType,
                title: item.title,
                isRequired: item.isRequired,
                contentHtml: item.contentHtml,
                prompt: item.prompt,
                options: item.options,
                correctOptionId: item.correctOptionId,
                explanation: item.explanation,
                completionPoints: item.completionPoints,
                correctPoints: item.correctPoints,
            })),
        [items]
    );

    function patchItem(key: string, patch: Partial<DraftItem>) {
        setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
    }

    function buildPayload(item: DraftItem): string | undefined {
        if (item.itemType === 'COURSE_SLIDE') {
            // The learner app needs the whole path to deep-link into the slide, not
            // just its id.
            return item.slide ? JSON.stringify(item.slide) : undefined;
        }
        if (item.itemType === 'QUESTION_OF_DAY' || item.itemType === 'POLL') {
            return JSON.stringify({
                prompt: item.prompt ?? '',
                options: (item.options ?? []).filter((o) => o.text.trim().length > 0),
                // Only the question type has an answer key; the server strips it
                // from every learner response until the reveal time passes.
                ...(item.itemType === 'QUESTION_OF_DAY'
                    ? {
                          correctOptionId: item.correctOptionId,
                          explanation: item.explanation ?? '',
                      }
                    : {}),
            });
        }
        return undefined;
    }

    function validate(): string | null {
        if (!title.trim()) return 'Give the plan a title.';
        if (batches.length === 0) return 'Pick at least one batch.';
        if (endTime <= startTime) return 'The end time must be after the start time.';
        if (items.length === 0) return 'Add at least one task.';
        for (const item of items) {
            if (!item.title.trim()) return 'Every task needs a title.';
            if (item.itemType === 'COURSE_SLIDE' && !item.slide) {
                return 'Pick the course content for every course-content task.';
            }
            if (item.itemType === 'QUESTION_OF_DAY') {
                const filled = (item.options ?? []).filter((o) => o.text.trim().length > 0);
                if (filled.length < 2) return 'A question needs at least two options.';
                if (!filled.some((o) => o.id === item.correctOptionId)) {
                    return 'Mark which option is correct.';
                }
            }
        }
        return null;
    }

    async function handleSave() {
        const problem = validate();
        if (problem) {
            setError(problem);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const request: EngagementPlanRequest = {
                title: title.trim(),
                description: description.trim() || undefined,
                status: publish ? 'PUBLISHED' : 'DRAFT',
                defaultMissPolicy: missPolicy,
                defaultCatchUpDays: missPolicy === 'EXPIRES' ? undefined : 2,
                defaultCatchUpPercent: missPolicy === 'CATCH_UP_REDUCED' ? 50 : undefined,
                slots: [
                    {
                        // Carry the slot id when editing, or the save would add a second
                        // slot beside the one being edited instead of updating it.
                        ...(slotId ? { id: slotId } : {}),
                        title: title.trim(),
                        startDate,
                        endDate: endDate || undefined,
                        startTime,
                        endTime,
                        revealTime: revealTime || undefined,
                        notifyTime: notifyTime || undefined,
                        items: items.map((item, index) => ({
                            ...(item.id ? { id: item.id } : {}),
                            itemType: item.itemType,
                            title: item.title.trim(),
                            sortOrder: index,
                            isRequired: item.isRequired,
                            contentHtml: item.contentHtml,
                            slideId: item.slide?.slideId,
                            payloadJson: buildPayload(item),
                            completionPoints: item.completionPoints ?? 0,
                            correctPoints: item.correctPoints ?? 0,
                            maxScore: item.maxScore,
                        })),
                    },
                ],
            };

            if (isEdit && planId) {
                await updateEngagementPlan(planId, request);
            } else {
                await createEngagementPlan({
                    ...request,
                    packageSessionIds: batches.map((b) => b.id),
                });
            }
            onCreated();
            onOpenChange(false);
        } catch (e: unknown) {
            const message =
                (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Could not save this plan.';
            setError(message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-screen w-full overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="text-start">
                        {isEdit ? 'Edit engagement plan' : 'New engagement plan'}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="space-y-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="plan-title">Title</Label>
                                <Input
                                    id="plan-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Daily question — Physics"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Batches</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    // A saved plan belongs to one batch, so editing cannot
                                    // move it; create a new plan for another batch instead.
                                    disabled={isEdit}
                                    className="h-10 w-full justify-start font-normal"
                                    onClick={() => setBatchPickerOpen(true)}
                                >
                                    {batches.length === 0
                                        ? 'Select batches'
                                        : batches.length === 1
                                          ? batches[0]!.label
                                          : `${batches.length} batches selected`}
                                </Button>
                                {isEdit ? (
                                    <p className="text-xs text-neutral-500">
                                        A plan belongs to one batch. To run this on another batch,
                                        create a new plan there.
                                    </p>
                                ) : (
                                    batches.length > 1 && (
                                        <p className="text-xs text-neutral-500">
                                            One plan is created per batch, so each batch keeps its
                                            own tracking and leaderboard.
                                        </p>
                                    )
                                )}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="plan-description">Description</Label>
                            <Textarea
                                id="plan-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What this plan is for (learners never see this)"
                            />
                        </div>

                        <div className="rounded-lg border border-neutral-200 p-4">
                            <p className="text-sm font-medium text-neutral-900">
                                When learners see it
                            </p>
                            <p className="mt-0.5 text-xs text-neutral-500">
                                Times are in your institute&apos;s timezone.
                            </p>
                            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="plan-start-date">First day</Label>
                                    <Input
                                        id="plan-start-date"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="plan-end-date">Last day (optional)</Label>
                                    <Input
                                        id="plan-end-date"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="plan-notify">Notify at</Label>
                                    <Input
                                        id="plan-notify"
                                        type="time"
                                        value={notifyTime}
                                        onChange={(e) => setNotifyTime(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="plan-start-time">Opens at</Label>
                                    <Input
                                        id="plan-start-time"
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="plan-end-time">Closes at</Label>
                                    <Input
                                        id="plan-end-time"
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="plan-reveal">Reveal answers at</Label>
                                    <Input
                                        id="plan-reveal"
                                        type="time"
                                        value={revealTime}
                                        onChange={(e) => setRevealTime(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 space-y-1.5">
                                <Label>If a learner misses it</Label>
                                <div className="flex flex-wrap gap-2">
                                    {MISS_POLICIES.map((policy) => (
                                        <button
                                            key={policy.value}
                                            type="button"
                                            onClick={() => setMissPolicy(policy.value)}
                                            className={
                                                missPolicy === policy.value
                                                    ? 'rounded-lg border border-primary-400 bg-primary-50 px-3 py-2 text-start text-xs'
                                                    : 'rounded-lg border border-neutral-200 px-3 py-2 text-start text-xs hover:border-neutral-300'
                                            }
                                        >
                                            <span className="block font-medium text-neutral-900">
                                                {policy.label}
                                            </span>
                                            <span className="block text-neutral-500">
                                                {policy.hint}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-neutral-900">Tasks</p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setItems((prev) => [...prev, newItem()])}
                                >
                                    <Plus size={16} /> Add task
                                </Button>
                            </div>

                            {items.map((item, index) => (
                                <div
                                    key={item.key}
                                    onFocusCapture={() => setActiveKey(item.key)}
                                    className={
                                        activeKey === item.key
                                            ? 'space-y-3 rounded-lg border border-primary-300 p-4'
                                            : 'space-y-3 rounded-lg border border-neutral-200 p-4'
                                    }
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            {ITEM_TYPES.map((type) => (
                                                <button
                                                    key={type.value}
                                                    type="button"
                                                    onClick={() =>
                                                        patchItem(item.key, {
                                                            itemType: type.value,
                                                        })
                                                    }
                                                    className={
                                                        item.itemType === type.value
                                                            ? 'rounded-md bg-primary-500 px-2.5 py-1 text-xs font-medium text-white'
                                                            : 'rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200'
                                                    }
                                                >
                                                    {type.label}
                                                </button>
                                            ))}
                                        </div>
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                aria-label="Remove task"
                                                onClick={() =>
                                                    setItems((prev) =>
                                                        prev.filter((it) => it.key !== item.key)
                                                    )
                                                }
                                                className="text-neutral-400 hover:text-danger-600"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor={`item-title-${index}`}>Task title</Label>
                                        <Input
                                            id={`item-title-${index}`}
                                            value={item.title}
                                            onChange={(e) =>
                                                patchItem(item.key, { title: e.target.value })
                                            }
                                            placeholder="Today's question"
                                        />
                                    </div>

                                    {item.itemType === 'COURSE_SLIDE' && (
                                        <div className="space-y-1.5">
                                            <Label>Course content</Label>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-10 w-full justify-start font-normal"
                                                disabled={batches.length === 0}
                                                onClick={() => setSlidePickerFor(item.key)}
                                            >
                                                {item.slide
                                                    ? `🎓 ${item.slide.slideTitle}`
                                                    : batches.length === 0
                                                      ? 'Pick a batch first'
                                                      : 'Choose a lesson from this course'}
                                            </Button>
                                            <p className="text-xs text-neutral-500">
                                                The learner opens it in the course library. It
                                                counts as done once they finish it there, so nothing
                                                is tracked twice.
                                            </p>
                                        </div>
                                    )}

                                    {(item.itemType === 'READING_HTML' ||
                                        item.itemType === 'VISUAL_NOTE' ||
                                        item.itemType === 'GAME') && (
                                        <div className="space-y-1.5">
                                            <Label htmlFor={`item-html-${index}`}>
                                                {item.itemType === 'GAME' ? 'Game HTML' : 'Content'}
                                            </Label>
                                            {item.itemType === 'GAME' ? (
                                                // A game is a self-contained document with its own
                                                // scripts and styles — a rich-text editor would rewrite
                                                // it. Authored as raw HTML on purpose.
                                                <Textarea
                                                    id={`item-html-${index}`}
                                                    value={item.contentHtml ?? ''}
                                                    onChange={(e) =>
                                                        patchItem(item.key, {
                                                            contentHtml: e.target.value,
                                                        })
                                                    }
                                                    rows={5}
                                                    placeholder="<!DOCTYPE html> …"
                                                    className="font-mono text-xs"
                                                />
                                            ) : (
                                                <TipTapEditor
                                                    value={item.contentHtml ?? ''}
                                                    onChange={(html) =>
                                                        patchItem(item.key, { contentHtml: html })
                                                    }
                                                    placeholder="What should the learner read?"
                                                    minHeight={160}
                                                />
                                            )}
                                            {item.itemType === 'GAME' && (
                                                <p className="text-xs text-neutral-500">
                                                    Runs sandboxed, with no access to the learner
                                                    app. A game reports its score by posting{' '}
                                                    <code className="rounded bg-neutral-100 px-1">
                                                        {GAME_SCORE_SNIPPET}
                                                    </code>{' '}
                                                    to its parent. The server clamps that score to
                                                    the task&apos;s maximum and, because the page
                                                    reports its own number, caps what it can
                                                    contribute to the leaderboard.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {(item.itemType === 'QUESTION_OF_DAY' ||
                                        item.itemType === 'POLL') && (
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <Label>Question</Label>
                                                <TipTapEditor
                                                    value={item.prompt ?? ''}
                                                    onChange={(html) =>
                                                        patchItem(item.key, { prompt: html })
                                                    }
                                                    placeholder="Ask the question"
                                                    minHeight={90}
                                                    minimalToolbar
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Options</Label>
                                                {(item.options ?? []).map((option, optionIndex) => (
                                                    <div
                                                        key={option.id}
                                                        className="flex items-center gap-2"
                                                    >
                                                        {item.itemType === 'QUESTION_OF_DAY' && (
                                                            <input
                                                                type="radio"
                                                                name={`correct-${item.key}`}
                                                                checked={
                                                                    item.correctOptionId ===
                                                                    option.id
                                                                }
                                                                onChange={() =>
                                                                    patchItem(item.key, {
                                                                        correctOptionId: option.id,
                                                                    })
                                                                }
                                                                aria-label={`Option ${option.id} is correct`}
                                                            />
                                                        )}
                                                        <Input
                                                            value={option.text}
                                                            onChange={(e) => {
                                                                const next = [
                                                                    ...(item.options ?? []),
                                                                ];
                                                                next[optionIndex] = {
                                                                    ...option,
                                                                    text: e.target.value,
                                                                };
                                                                patchItem(item.key, {
                                                                    options: next,
                                                                });
                                                            }}
                                                            placeholder={`Option ${option.id.toUpperCase()}`}
                                                        />
                                                    </div>
                                                ))}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const next = [...(item.options ?? [])];
                                                        const id = String.fromCharCode(
                                                            97 + next.length
                                                        );
                                                        next.push({ id, text: '' });
                                                        patchItem(item.key, { options: next });
                                                    }}
                                                >
                                                    <Plus size={14} /> Option
                                                </Button>
                                            </div>
                                            {item.itemType === 'QUESTION_OF_DAY' && (
                                                <div className="space-y-1.5">
                                                    <Label>Explanation (shown at reveal)</Label>
                                                    <TipTapEditor
                                                        value={item.explanation ?? ''}
                                                        onChange={(html) =>
                                                            patchItem(item.key, {
                                                                explanation: html,
                                                            })
                                                        }
                                                        placeholder="Why is that the answer?"
                                                        minHeight={90}
                                                        minimalToolbar
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor={`item-completion-${index}`}>
                                                Points for completing
                                            </Label>
                                            <Input
                                                id={`item-completion-${index}`}
                                                type="number"
                                                value={item.completionPoints ?? 0}
                                                onChange={(e) =>
                                                    patchItem(item.key, {
                                                        completionPoints: Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </div>
                                        {item.itemType === 'QUESTION_OF_DAY' && (
                                            <div className="space-y-1.5">
                                                <Label htmlFor={`item-correct-${index}`}>
                                                    Bonus if correct
                                                </Label>
                                                <Input
                                                    id={`item-correct-${index}`}
                                                    type="number"
                                                    value={item.correctPoints ?? 0}
                                                    onChange={(e) =>
                                                        patchItem(item.key, {
                                                            correctPoints: Number(e.target.value),
                                                        })
                                                    }
                                                />
                                            </div>
                                        )}
                                        <div className="flex items-end gap-2">
                                            <Switch
                                                id={`item-required-${index}`}
                                                checked={Boolean(item.isRequired)}
                                                onCheckedChange={(checked) =>
                                                    patchItem(item.key, { isRequired: checked })
                                                }
                                            />
                                            <Label htmlFor={`item-required-${index}`}>
                                                Required
                                            </Label>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {error && (
                            <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
                                {error}
                            </p>
                        )}
                    </div>

                    {/* Sticky so the preview stays in view while a long form scrolls. */}
                    <aside className="lg:sticky lg:top-0 lg:self-start">
                        <PlanPreview
                            tasks={previewTasks}
                            startTime={startTime}
                            endTime={endTime}
                            revealTime={revealTime}
                            missPolicy={missPolicy}
                            catchUpPercent={50}
                            activeKey={activeKey}
                        />
                    </aside>
                </div>

                <DialogFooter className="items-center gap-3 sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Switch id="plan-publish" checked={publish} onCheckedChange={setPublish} />
                        <Label htmlFor="plan-publish">
                            {isEdit ? 'Published to learners' : 'Publish to learners now'}
                        </Label>
                    </div>
                    <MyButton type="button" onClick={handleSave} disable={saving}>
                        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save plan'}
                    </MyButton>
                </DialogFooter>
            </DialogContent>

            {slidePickerFor && batches[0] && (
                <CourseSlidePicker
                    open={Boolean(slidePickerFor)}
                    onOpenChange={(next) => {
                        if (!next) setSlidePickerFor(null);
                    }}
                    packageSessionId={batches[0].id}
                    onPick={(slide) => {
                        const target = slidePickerFor;
                        patchItem(target, {
                            slide,
                            // Seed an empty title with the lesson's own name.
                            ...(items.find((i) => i.key === target)?.title
                                ? {}
                                : { title: slide.slideTitle }),
                        });
                        setSlidePickerFor(null);
                    }}
                />
            )}

            <BatchPickerDialog
                open={batchPickerOpen}
                onOpenChange={setBatchPickerOpen}
                selected={batches}
                onConfirm={setBatches}
            />
        </Dialog>
    );
}
