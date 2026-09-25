import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
    ArrowClockwise,
    GraduationCap,
    Plus,
    Trash,
    Warning,
    WarningCircle,
} from '@phosphor-icons/react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
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
    QuestionFormat,
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

// Labels and hints live in locales/<lng>/engagement.json under composer.types,
// composer.miss and composer.formats, keyed by these values.
const ITEM_TYPES: EngagementItemType[] = [
    'READING_HTML',
    'VISUAL_NOTE',
    'QUESTION_OF_DAY',
    'GAME',
    'POLL',
    'COURSE_SLIDE',
];

const MISS_POLICIES: MissPolicy[] = ['EXPIRES', 'CATCH_UP_FULL', 'CATCH_UP_REDUCED'];

/**
 * The message a teacher's game posts to report its result. Matches the protocol the
 * HTML slide renderer already speaks, so a game written for a slide works here
 * unchanged. Kept as a string constant because the braces read as a hex colour to
 * the design linter when written as an HTML entity.
 */
const GAME_SCORE_SNIPPET = "postMessage({ type: 'vacademy:complete', score, maxScore })";

const QUESTION_FORMATS: QuestionFormat[] = ['MCQ', 'TEXT', 'UPLOAD'];

interface DraftItem extends EngagementItemRequest {
    /** Local-only key so rows stay stable before the server assigns ids. */
    key: string;
    /** Set when the row came from a saved plan; drives update instead of insert. */
    id?: string;
    /** Chosen course slide, serialised into slideId + payloadJson on save. */
    slide?: PickedSlide;
    /** MCQ | TEXT | UPLOAD for a question of the day. */
    format?: QuestionFormat;
    /** QUESTION_OF_DAY authoring, serialised into payloadJson on save. */
    prompt?: string;
    options?: { id: string; text: string }[];
    correctOptionId?: string;
    explanation?: string;
}

/** Today on the teacher's own calendar as yyyy-MM-dd, the default first day of a new plan. */
function today(): string {
    // Not toISOString: that is the UTC date, which is still yesterday before 05:30 IST.
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

/** Day-1 slot fields this form doesn't edit but must send back unchanged. */
interface SlotMeta {
    title?: string | null;
    sortOrder?: number;
    dowMask?: number | null;
}

function newItem(): DraftItem {
    return {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        itemType: 'READING_HTML',
        format: 'MCQ',
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

/** Rich text that renders as nothing ("<p></p>", "<p><br></p>", whitespace) counts as empty. */
function emptyRichTextToBlank(html: string | undefined | null): string {
    if (!html) return '';
    if (/<(img|iframe|video|audio|hr)\b/i.test(html)) return html;
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim() === ''
        ? ''
        : html;
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
    const { t } = useTranslation('engagement');
    const navigate = useNavigate();
    const isEdit = Boolean(planId);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [batches, setBatches] = useState<BatchOption[]>([]);
    const [batchPickerOpen, setBatchPickerOpen] = useState(false);
    /** Which task row is choosing a slide, by its local key. */
    const [slidePickerFor, setSlidePickerFor] = useState<string | null>(null);
    const [startDate, setStartDate] = useState(today);
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
    const [slotMeta, setSlotMeta] = useState<SlotMeta | null>(null);
    const [activeKey, setActiveKey] = useState<string | null>(null);
    /** False until the form holds what it should (defaults, or the loaded plan). */
    const [formReady, setFormReady] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    /** The form as it was when it opened, to tell whether closing loses edits. */
    const [baseline, setBaseline] = useState<string | null>(null);
    const [baselineSeq, setBaselineSeq] = useState(0);
    /** Bumped on every open, so an edit always loads the plan fresh. */
    const [openSeq, setOpenSeq] = useState(0);
    // Starts false so a composer mounted already open (the slide page) still resets.
    const [wasOpen, setWasOpen] = useState(false);

    /**
     * Back to defaults, plus whatever the caller seeded. An edit starts here too, so a
     * plan with no active day never shows the previous open's slot or tasks.
     */
    function resetForm() {
        const seeded = seedBatch();
        setTitle(presetSlide?.slideTitle ?? '');
        setDescription('');
        setBatches(seeded ? [seeded] : []);
        setStartDate(today());
        setEndDate('');
        setStartTime('06:00');
        setEndTime('20:00');
        setRevealTime('20:00');
        setNotifyTime('06:00');
        setMissPolicy('EXPIRES');
        setPublish(true);
        setItems(
            presetSlide
                ? [
                      {
                          ...newItem(),
                          itemType: 'COURSE_SLIDE',
                          title: presetSlide.slideTitle,
                          slide: presetSlide,
                          completionPoints: 10,
                          isRequired: true,
                      },
                  ]
                : [newItem()]
        );
        setError(null);
        setSlotId(null);
        setSlotMeta(null);
        setActiveKey(null);
    }

    /**
     * The batch a new plan starts on: the one the caller is showing, else the batch
     * the preset slide's course, session and level belong to.
     */
    function seedBatch(): BatchOption | null {
        if (defaultPackageSessionId) {
            return { id: defaultPackageSessionId, label: t('composer.thisBatch') };
        }
        if (!presetSlide?.courseId || !presetSlide.sessionId || !presetSlide.levelId) return null;
        const store = useInstituteDetailsStore.getState();
        const id = store.getPackageSessionId({
            courseId: presetSlide.courseId,
            sessionId: presetSlide.sessionId,
            levelId: presetSlide.levelId,
        });
        if (!id) return null;
        const batch = store.getDetailsFromPackageSessionId({ packageSessionId: id });
        const label =
            batch?.name ||
            (batch
                ? `${batch.package_dto.package_name} · ${batch.level.level_name}`
                : t('composer.thisBatch'));
        return { id, label };
    }

    // Runs during render (React's "adjust state when a prop changes" pattern) so the
    // first painted frame of a new plan is already reset, not the previous plan.
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setOpenSeq((n) => n + 1);
            setConfirmDiscard(false);
            resetForm();
            if (isEdit) {
                // Ready (and baselined) once the plan has loaded; see the effect below.
                setFormReady(false);
                setBaseline(null);
            } else {
                setFormReady(true);
                setBaselineSeq((n) => n + 1);
            }
        }
    }

    // Load the plan being edited and fill the form from it. Keyed per open and never
    // refetched in the background, so a refetch can't overwrite edits in progress.
    const editQuery = useQuery({
        queryKey: ['engagement-plan-edit', planId, openSeq],
        queryFn: () => getEngagementPlan(planId!),
        enabled: open && Boolean(planId),
        gcTime: 0,
        staleTime: Infinity,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
    const existing = editQuery.data;
    /** Day 1 is all this editor can change; the others are kept as they are. */
    const dayCount = isEdit ? existing?.slots?.length ?? 0 : 0;
    const multiDay = dayCount > 1;

    useEffect(() => {
        if (!open || !existing) return;
        setTitle(existing.title ?? '');
        setDescription(existing.description ?? '');
        setMissPolicy(existing.defaultMissPolicy ?? 'EXPIRES');
        setPublish(existing.status === 'PUBLISHED');
        setBatches([{ id: existing.packageSessionId, label: t('composer.thisBatch') }]);

        const slot = existing.slots?.[0];
        setFormReady(true);
        setBaselineSeq((n) => n + 1);
        if (!slot) return;
        setSlotId(slot.id);
        setSlotMeta({ title: slot.title, sortOrder: slot.sortOrder, dowMask: slot.dowMask });
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
                    hideResultUntilReveal: item.hideResultUntilReveal ?? false,
                    format: ((parsed as { format?: QuestionFormat }).format ??
                        'MCQ') as QuestionFormat,
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
    }, [open, existing, t]);

    // Everything the teacher can change, serialised; local row keys are left out so
    // a reset with fresh keys still compares equal.
    const snapshot = useMemo(
        () =>
            JSON.stringify({
                title,
                description,
                batches: batches.map((b) => b.id),
                startDate,
                endDate,
                startTime,
                endTime,
                revealTime,
                notifyTime,
                missPolicy,
                publish,
                items: items.map((item) => ({
                    ...item,
                    key: undefined,
                    // The rich-text editor normalises an empty body to "<p></p>" right
                    // after it mounts, which would otherwise mark an untouched form dirty.
                    contentHtml: emptyRichTextToBlank(item.contentHtml),
                    prompt: emptyRichTextToBlank(item.prompt),
                    explanation: emptyRichTextToBlank(item.explanation),
                })),
            }),
        [
            title,
            description,
            batches,
            startDate,
            endDate,
            startTime,
            endTime,
            revealTime,
            notifyTime,
            missPolicy,
            publish,
            items,
        ]
    );

    // Take the baseline on the render after a reset or load has landed in state.
    useEffect(() => {
        if (baselineSeq > 0) setBaseline(snapshot);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baselineSeq]);

    const isDirty = formReady && baseline !== null && snapshot !== baseline;

    /** Escape, the overlay and the close button all land here. */
    function handleOpenChange(next: boolean) {
        if (next) {
            onOpenChange(true);
            return;
        }
        if (saving) return;
        if (isDirty) {
            setConfirmDiscard(true);
            return;
        }
        onOpenChange(false);
    }

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
            const format: QuestionFormat = item.itemType === 'POLL' ? 'MCQ' : item.format ?? 'MCQ';
            const isMcq = format === 'MCQ';
            return JSON.stringify({
                format,
                prompt: item.prompt ?? '',
                // Only a multiple-choice question has options to show.
                ...(isMcq
                    ? { options: (item.options ?? []).filter((o) => o.text.trim().length > 0) }
                    : {}),
                // Only a graded question has an answer key; the server strips it from
                // every learner response until the reveal time passes.
                ...(item.itemType === 'QUESTION_OF_DAY' && isMcq
                    ? {
                          correctOptionId: item.correctOptionId,
                          explanation: item.explanation ?? '',
                      }
                    : {}),
                ...(item.itemType === 'QUESTION_OF_DAY' && !isMcq
                    ? { explanation: item.explanation ?? '' }
                    : {}),
            });
        }
        return undefined;
    }

    function validate(): string | null {
        if (!title.trim()) return t('composer.errors.title');
        if (batches.length === 0) return t('composer.errors.batch');
        if (endTime <= startTime) return t('composer.errors.time');
        if (items.length === 0) return t('composer.errors.tasks');
        for (const item of items) {
            if (!item.title.trim()) return t('composer.errors.taskTitle');
            if (item.itemType === 'COURSE_SLIDE' && !item.slide) {
                return t('composer.errors.content');
            }
            if (item.itemType === 'QUESTION_OF_DAY' && (item.format ?? 'MCQ') === 'MCQ') {
                const filled = (item.options ?? []).filter((o) => o.text.trim().length > 0);
                if (filled.length < 2) return t('composer.errors.options');
                if (!filled.some((o) => o.id === item.correctOptionId)) {
                    return t('composer.errors.correct');
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
                // Keep a saved plan's own catch-up terms; these are only the defaults.
                defaultCatchUpDays:
                    missPolicy === 'EXPIRES' ? undefined : existing?.defaultCatchUpDays ?? 2,
                defaultCatchUpPercent:
                    missPolicy === 'CATCH_UP_REDUCED'
                        ? existing?.defaultCatchUpPercent ?? 50
                        : undefined,
                slots: [
                    {
                        // Carry the slot id when editing, or the save would add a second
                        // slot beside the one being edited instead of updating it.
                        ...(slotId ? { id: slotId } : {}),
                        // The server overwrites every slot field it is sent, so send the
                        // day's own order and weekdays back unchanged. On a multi-day plan
                        // the day keeps its own title (an AI day theme) too.
                        title: (multiDay && slotMeta?.title) || title.trim(),
                        ...(slotMeta
                            ? {
                                  sortOrder: slotMeta.sortOrder,
                                  dowMask: slotMeta.dowMask ?? undefined,
                              }
                            : {}),
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
                            hideResultUntilReveal: item.hideResultUntilReveal,
                        })),
                    },
                ],
            };

            if (isEdit && planId) {
                await updateEngagementPlan(planId, request);
                toast.success(t('composer.saved'));
            } else {
                const created = await createEngagementPlan({
                    ...request,
                    packageSessionIds: batches.map((b) => b.id),
                });
                const firstBatchId = batches[0]?.id;
                toast.success(
                    t('composer.created', { count: created.length }),
                    // Off the engagement page (the slide editor), offer a way to the plan.
                    presetSlide && firstBatchId
                        ? {
                              action: {
                                  label: t('composer.viewPlan'),
                                  onClick: () =>
                                      void navigate({
                                          to: '/engagement',
                                          search: { packageSessionId: firstBatchId },
                                      }),
                              },
                          }
                        : undefined
                );
            }
            onCreated();
            onOpenChange(false);
        } catch (e: unknown) {
            const message =
                (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                t('composer.errors.save');
            setError(message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-screen w-full overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="text-start">
                        {isEdit ? t('composer.titleEdit') : t('composer.titleNew')}
                    </DialogTitle>
                </DialogHeader>

                {isEdit && !formReady && !editQuery.isError && (
                    <div className="space-y-4" aria-busy="true">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-56 w-full" />
                    </div>
                )}

                {isEdit && editQuery.isError && (
                    <Alert className="border-danger-200 bg-danger-50 text-danger-700">
                        <div className="flex flex-wrap items-center gap-3">
                            <WarningCircle size={18} className="shrink-0" />
                            <AlertDescription className="min-w-0 flex-1">
                                {t('composer.loadError')}
                            </AlertDescription>
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                onClick={() => void editQuery.refetch()}
                            >
                                <ArrowClockwise size={14} /> {t('common.retry')}
                            </MyButton>
                        </div>
                    </Alert>
                )}

                {formReady && (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <div className="space-y-6">
                            {multiDay && (
                                <Alert className="border-warning-200 bg-warning-50 text-warning-700">
                                    <div className="flex items-start gap-3">
                                        <Warning size={18} className="mt-0.5 shrink-0" />
                                        <AlertDescription className="min-w-0 flex-1">
                                            {t('composer.multiDay', { count: dayCount })}
                                        </AlertDescription>
                                    </div>
                                </Alert>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="plan-title">{t('composer.title')}</Label>
                                    <Input
                                        id="plan-title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder={t('composer.titlePlaceholder')}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>{t('composer.batches')}</Label>
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
                                            ? t('composer.selectBatches')
                                            : batches.length === 1
                                              ? batches[0]!.label
                                              : t('composer.batchesSelected', {
                                                    count: batches.length,
                                                })}
                                    </Button>
                                    {isEdit ? (
                                        <p className="text-xs text-neutral-500">
                                            {t('composer.editOneBatch')}
                                        </p>
                                    ) : (
                                        batches.length > 1 && (
                                            <p className="text-xs text-neutral-500">
                                                {t('composer.onePerBatch')}
                                            </p>
                                        )
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="plan-description">
                                    {t('composer.description')}
                                </Label>
                                <Textarea
                                    id="plan-description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={t('composer.descriptionPlaceholder')}
                                />
                            </div>

                            <div className="rounded-lg border border-neutral-200 p-4">
                                <p className="text-sm font-medium text-neutral-900">
                                    {t('composer.when')}
                                </p>
                                <p className="mt-0.5 text-xs text-neutral-500">
                                    {t('composer.tz')}
                                </p>
                                {multiDay && (
                                    <p className="mt-0.5 text-xs text-neutral-500">
                                        {t('composer.datesLocked')}
                                    </p>
                                )}
                                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="plan-start-date">
                                            {t('composer.firstDay')}
                                        </Label>
                                        {/* Locked on a multi-day plan: widening day 1 would stack
                                        its tasks on top of the days after it. */}
                                        <Input
                                            id="plan-start-date"
                                            type="date"
                                            value={startDate}
                                            disabled={multiDay}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="plan-end-date">
                                            {t('composer.lastDay')}
                                        </Label>
                                        <Input
                                            id="plan-end-date"
                                            type="date"
                                            value={endDate}
                                            disabled={multiDay}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="plan-notify">
                                            {t('composer.notifyAt')}
                                        </Label>
                                        <Input
                                            id="plan-notify"
                                            type="time"
                                            value={notifyTime}
                                            onChange={(e) => setNotifyTime(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="plan-start-time">
                                            {t('composer.opensAt')}
                                        </Label>
                                        <Input
                                            id="plan-start-time"
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="plan-end-time">
                                            {t('composer.closesAt')}
                                        </Label>
                                        <Input
                                            id="plan-end-time"
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="plan-reveal">
                                            {t('composer.revealAt')}
                                        </Label>
                                        <Input
                                            id="plan-reveal"
                                            type="time"
                                            value={revealTime}
                                            onChange={(e) => setRevealTime(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="mt-4 space-y-1.5">
                                    <Label>{t('composer.ifMissed')}</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {MISS_POLICIES.map((policy) => (
                                            <button
                                                key={policy}
                                                type="button"
                                                onClick={() => setMissPolicy(policy)}
                                                className={
                                                    missPolicy === policy
                                                        ? 'rounded-lg border border-primary-400 bg-primary-50 px-3 py-2 text-start text-xs'
                                                        : 'rounded-lg border border-neutral-200 px-3 py-2 text-start text-xs hover:border-neutral-300'
                                                }
                                            >
                                                <span className="block font-medium text-neutral-900">
                                                    {t(`composer.miss.${policy}`)}
                                                </span>
                                                <span className="block text-neutral-500">
                                                    {t(`composer.miss.${policy}_hint`)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-neutral-900">
                                        {t('composer.tasks')}
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setItems((prev) => [...prev, newItem()])}
                                    >
                                        <Plus size={16} /> {t('composer.addTask')}
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
                                                        key={type}
                                                        type="button"
                                                        title={t(`composer.types.${type}_hint`)}
                                                        onClick={() =>
                                                            patchItem(item.key, {
                                                                itemType: type,
                                                            })
                                                        }
                                                        className={
                                                            item.itemType === type
                                                                ? 'rounded-md bg-primary-500 px-2.5 py-1 text-xs font-medium text-white'
                                                                : 'rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200'
                                                        }
                                                    >
                                                        {t(`composer.types.${type}`)}
                                                    </button>
                                                ))}
                                            </div>
                                            {items.length > 1 && (
                                                <button
                                                    type="button"
                                                    aria-label={t('composer.removeTask')}
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
                                            <Label htmlFor={`item-title-${index}`}>
                                                {t('composer.taskTitle')}
                                            </Label>
                                            <Input
                                                id={`item-title-${index}`}
                                                value={item.title}
                                                onChange={(e) =>
                                                    patchItem(item.key, { title: e.target.value })
                                                }
                                                placeholder={t('composer.taskTitlePlaceholder')}
                                            />
                                        </div>

                                        {item.itemType === 'COURSE_SLIDE' && (
                                            <div className="space-y-1.5">
                                                <Label>{t('composer.courseContent')}</Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-10 w-full justify-start font-normal"
                                                    disabled={batches.length === 0}
                                                    onClick={() => setSlidePickerFor(item.key)}
                                                >
                                                    {item.slide ? (
                                                        <span className="flex min-w-0 items-center gap-2">
                                                            <GraduationCap
                                                                size={16}
                                                                className="shrink-0 text-neutral-500"
                                                            />
                                                            <span className="truncate">
                                                                {item.slide.slideTitle}
                                                            </span>
                                                        </span>
                                                    ) : batches.length === 0 ? (
                                                        t('composer.pickBatchFirst')
                                                    ) : (
                                                        t('composer.chooseLesson')
                                                    )}
                                                </Button>
                                                <p className="text-xs text-neutral-500">
                                                    {t('composer.lessonHint')}
                                                </p>
                                            </div>
                                        )}

                                        {(item.itemType === 'READING_HTML' ||
                                            item.itemType === 'VISUAL_NOTE' ||
                                            item.itemType === 'GAME') && (
                                            <div className="space-y-1.5">
                                                <Label htmlFor={`item-html-${index}`}>
                                                    {item.itemType === 'GAME'
                                                        ? t('composer.gameHtml')
                                                        : t('composer.content')}
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
                                                            patchItem(item.key, {
                                                                contentHtml: html,
                                                            })
                                                        }
                                                        placeholder={t(
                                                            'composer.contentPlaceholder'
                                                        )}
                                                        minHeight={160}
                                                    />
                                                )}
                                                {item.itemType === 'GAME' && (
                                                    <p className="text-xs text-neutral-500">
                                                        {t('composer.gameHint')}{' '}
                                                        <code className="rounded bg-neutral-100 px-1">
                                                            {GAME_SCORE_SNIPPET}
                                                        </code>{' '}
                                                        {t('composer.gameHint2')}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {(item.itemType === 'QUESTION_OF_DAY' ||
                                            item.itemType === 'POLL') && (
                                            <div className="space-y-3">
                                                {item.itemType === 'QUESTION_OF_DAY' && (
                                                    <div className="space-y-1.5">
                                                        <Label>{t('composer.howAnswer')}</Label>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {QUESTION_FORMATS.map((f) => (
                                                                <button
                                                                    key={f}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        patchItem(item.key, {
                                                                            format: f,
                                                                        })
                                                                    }
                                                                    className={
                                                                        (item.format ?? 'MCQ') === f
                                                                            ? 'rounded-lg border border-primary-400 bg-primary-50 px-3 py-2 text-start text-xs'
                                                                            : 'rounded-lg border border-neutral-200 px-3 py-2 text-start text-xs hover:border-neutral-300'
                                                                    }
                                                                >
                                                                    <span className="block font-medium text-neutral-900">
                                                                        {t(`composer.formats.${f}`)}
                                                                    </span>
                                                                    <span className="block text-neutral-500">
                                                                        {t(
                                                                            `composer.formats.${f}_hint`
                                                                        )}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-1.5">
                                                    <Label>{t('composer.question')}</Label>
                                                    <TipTapEditor
                                                        value={item.prompt ?? ''}
                                                        onChange={(html) =>
                                                            patchItem(item.key, { prompt: html })
                                                        }
                                                        placeholder={t('composer.askPlaceholder')}
                                                        minHeight={90}
                                                        minimalToolbar
                                                    />
                                                </div>
                                                {/* Options belong to multiple choice only; a written
                                                or uploaded answer has nothing to choose from. */}
                                                {(item.itemType === 'POLL' ||
                                                    (item.format ?? 'MCQ') === 'MCQ') && (
                                                    <div className="space-y-2">
                                                        <Label>{t('composer.options')}</Label>
                                                        {(item.options ?? []).map(
                                                            (option, optionIndex) => (
                                                                <div
                                                                    key={option.id}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    {item.itemType ===
                                                                        'QUESTION_OF_DAY' && (
                                                                        <input
                                                                            type="radio"
                                                                            name={`correct-${item.key}`}
                                                                            checked={
                                                                                item.correctOptionId ===
                                                                                option.id
                                                                            }
                                                                            onChange={() =>
                                                                                patchItem(
                                                                                    item.key,
                                                                                    {
                                                                                        correctOptionId:
                                                                                            option.id,
                                                                                    }
                                                                                )
                                                                            }
                                                                            aria-label={t(
                                                                                'composer.optionCorrect',
                                                                                {
                                                                                    id: option.id.toUpperCase(),
                                                                                }
                                                                            )}
                                                                        />
                                                                    )}
                                                                    <Input
                                                                        value={option.text}
                                                                        onChange={(e) => {
                                                                            const next = [
                                                                                ...(item.options ??
                                                                                    []),
                                                                            ];
                                                                            next[optionIndex] = {
                                                                                ...option,
                                                                                text: e.target
                                                                                    .value,
                                                                            };
                                                                            patchItem(item.key, {
                                                                                options: next,
                                                                            });
                                                                        }}
                                                                        placeholder={t(
                                                                            'composer.optionPlaceholder',
                                                                            {
                                                                                id: option.id.toUpperCase(),
                                                                            }
                                                                        )}
                                                                    />
                                                                </div>
                                                            )
                                                        )}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                const next = [
                                                                    ...(item.options ?? []),
                                                                ];
                                                                const id = String.fromCharCode(
                                                                    97 + next.length
                                                                );
                                                                next.push({ id, text: '' });
                                                                patchItem(item.key, {
                                                                    options: next,
                                                                });
                                                            }}
                                                        >
                                                            <Plus size={14} />{' '}
                                                            {t('composer.option')}
                                                        </Button>
                                                    </div>
                                                )}
                                                {item.itemType === 'QUESTION_OF_DAY' && (
                                                    <div className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3">
                                                        <Switch
                                                            id={`item-hide-result-${index}`}
                                                            checked={Boolean(
                                                                item.hideResultUntilReveal
                                                            )}
                                                            onCheckedChange={(checked) =>
                                                                patchItem(item.key, {
                                                                    hideResultUntilReveal: checked,
                                                                })
                                                            }
                                                        />
                                                        <div className="space-y-0.5">
                                                            <Label
                                                                htmlFor={`item-hide-result-${index}`}
                                                            >
                                                                {t('composer.hideResult')}
                                                            </Label>
                                                            <p className="text-xs text-neutral-500">
                                                                {t('composer.hideResultHint')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {item.itemType === 'QUESTION_OF_DAY' && (
                                                    <div className="space-y-1.5">
                                                        <Label>{t('composer.explanation')}</Label>
                                                        <TipTapEditor
                                                            value={item.explanation ?? ''}
                                                            onChange={(html) =>
                                                                patchItem(item.key, {
                                                                    explanation: html,
                                                                })
                                                            }
                                                            placeholder={t(
                                                                'composer.explanationPlaceholder'
                                                            )}
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
                                                    {t('composer.completionPoints')}
                                                </Label>
                                                <Input
                                                    id={`item-completion-${index}`}
                                                    type="number"
                                                    value={item.completionPoints ?? 0}
                                                    onChange={(e) =>
                                                        patchItem(item.key, {
                                                            completionPoints: Number(
                                                                e.target.value
                                                            ),
                                                        })
                                                    }
                                                />
                                            </div>
                                            {item.itemType === 'QUESTION_OF_DAY' && (
                                                <div className="space-y-1.5">
                                                    <Label htmlFor={`item-correct-${index}`}>
                                                        {t('composer.bonus')}
                                                    </Label>
                                                    <Input
                                                        id={`item-correct-${index}`}
                                                        type="number"
                                                        value={item.correctPoints ?? 0}
                                                        onChange={(e) =>
                                                            patchItem(item.key, {
                                                                correctPoints: Number(
                                                                    e.target.value
                                                                ),
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
                                                    {t('composer.required')}
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
                                catchUpPercent={existing?.defaultCatchUpPercent ?? 50}
                                activeKey={activeKey}
                            />
                        </aside>
                    </div>
                )}

                <DialogFooter className="items-center gap-3 sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="plan-publish"
                            checked={publish}
                            disabled={!formReady}
                            onCheckedChange={setPublish}
                        />
                        <Label htmlFor="plan-publish">
                            {isEdit ? t('composer.published') : t('composer.publishNow')}
                        </Label>
                    </div>
                    {/* Disabled until an edited plan has loaded, so a save can never
                        write new-plan defaults over it. */}
                    <MyButton type="button" onClick={handleSave} disable={saving || !formReady}>
                        {saving
                            ? t('composer.saving')
                            : isEdit
                              ? t('composer.saveChanges')
                              : t('composer.savePlan')}
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

            <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-start">
                            {t('composer.discard.title')}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-start">
                            {t('composer.discard.description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('composer.discard.keep')}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-danger-600 hover:bg-danger-500"
                            onClick={() => {
                                setConfirmDiscard(false);
                                onOpenChange(false);
                            }}
                        >
                            {t('composer.discard.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
