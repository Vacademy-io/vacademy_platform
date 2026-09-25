import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    Sparkle,
    Image as ImageIcon,
    Trash,
    ArrowsClockwise,
    ClockCounterClockwise,
} from '@phosphor-icons/react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import { getInstituteId } from '@/constants/helper';
import { cn } from '@/lib/utils';
import { getLanguageSetting } from '@/services/language-settings';
import { normalizeTimezone } from '@/utils/timezone';
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
import { ENGAGEMENT_TYPE_ACCENT, PlanPreview, type PreviewTask } from './PlanPreview';

type Step = 'brief' | 'generating' | 'review';

const DURATIONS = [
    { days: 1, key: 'wizard.today' },
    { days: 7, key: 'wizard.week' },
    { days: 14, key: 'wizard.twoWeeks' },
    { days: 30, key: 'wizard.month' },
] as const;

const TASK_KINDS = ['question_of_day', 'text_question', 'poll', 'reading', 'game'] as const;
const KIND_LABEL_KEY: Record<(typeof TASK_KINDS)[number], string> = {
    question_of_day: 'wizard.kind_question',
    text_question: 'wizard.kind_text',
    poll: 'wizard.kind_poll',
    reading: 'wizard.kind_reading',
    game: 'wizard.kind_game',
};

/**
 * A reviewed draft cost real credits, so it outlives the dialog: it is mirrored to
 * sessionStorage (per institute, per tab) and offered back on the brief step. Grounding
 * texts are left out; they can be megabytes of slide HTML.
 */
interface StoredAiDraft {
    v: 1;
    savedAt: number;
    draft: AiPlanDraft;
    creditsSpent: number;
    batches: BatchOption[];
    topic: string;
    startTime: string;
    endTime: string;
    revealTime: string;
    language: string;
    difficulty: AiPlanBrief['difficulty'];
    mix: AiPlanBrief['mix'];
}

const draftStorageKey = () => `engagement.aiDraft.${getInstituteId() ?? 'unknown'}`;

function readStoredDraft(): StoredAiDraft | null {
    try {
        const raw = sessionStorage.getItem(draftStorageKey());
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredAiDraft;
        return parsed?.v === 1 && Array.isArray(parsed.draft?.slots) ? parsed : null;
    } catch {
        return null;
    }
}

function writeStoredDraft(value: StoredAiDraft) {
    try {
        sessionStorage.setItem(draftStorageKey(), JSON.stringify(value));
    } catch {
        // Storage full or blocked: the draft still lives in memory until the tab closes.
    }
}

function clearStoredDraft() {
    try {
        sessionStorage.removeItem(draftStorageKey());
    } catch {
        // Nothing to clear.
    }
}

function instituteTimeZone(): string {
    return normalizeTimezone(getLanguageSetting()?.timezone);
}

/** Today's date (yyyy-MM-dd) in the institute's timezone, where plan windows live. */
function instituteToday(): string {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: instituteTimeZone(),
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(new Date());
        const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
        return `${get('year')}-${get('month')}-${get('day')}`;
    } catch {
        return new Date().toISOString().slice(0, 10);
    }
}

/**
 * A slot date ("2026-09-25") as "Thu, 25 Sep". The string is already an institute-local
 * calendar day, so it is pinned to UTC midnight and formatted in UTC; formatting it in
 * a zone ahead of or behind UTC would shift it by a day.
 */
function formatSlotDate(isoDate: string, locale: string): string {
    const [y, m, d] = isoDate.split('-').map(Number);
    if (!y || !m || !d) return isoDate;
    const date = new Date(Date.UTC(y, m - 1, d));
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    };
    try {
        return new Intl.DateTimeFormat(locale, options).format(date);
    } catch {
        return new Intl.DateTimeFormat(undefined, options).format(date);
    }
}

/** "5 minutes ago" in the admin's language. */
function formatAgo(savedAt: number, locale: string): string {
    const minutes = Math.round((savedAt - Date.now()) / 60_000);
    try {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        if (minutes === 0) return rtf.format(0, 'second');
        return Math.abs(minutes) < 60
            ? rtf.format(minutes, 'minute')
            : rtf.format(Math.round(minutes / 60), 'hour');
    } catch {
        return '';
    }
}

/**
 * The QUESTION_OF_DAY answer format carried in payloadJson, read the way the server
 * grades it: blank means MCQ, case is ignored.
 */
function questionFormat(item: EngagementItemRequest): string | null {
    if (item.itemType !== 'QUESTION_OF_DAY') return null;
    try {
        const format = (JSON.parse(item.payloadJson ?? '{}') as { format?: string | null })?.format
            ?.trim()
            .toUpperCase();
        return format || 'MCQ';
    } catch {
        return 'MCQ';
    }
}

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
    const { t, i18n } = useTranslation('engagement');
    const [step, setStep] = useState<Step>('brief');
    const [error, setError] = useState<string | null>(null);

    // Brief
    const [batches, setBatches] = useState<BatchOption[]>([]);
    const [batchPickerOpen, setBatchPickerOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [topic, setTopic] = useState('');
    const [days, setDays] = useState(7);
    const [perDay, setPerDay] = useState(2);
    const [startDate, setStartDate] = useState(instituteToday);
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
    // Credits this draft has cost so far (draft + regenerations + pictures).
    const [creditsSpent, setCreditsSpent] = useState(0);
    // A draft from earlier in this tab that the teacher can pick back up.
    const [resumable, setResumable] = useState<StoredAiDraft | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    // Bumped on discard so a draft still in flight is dropped when it lands.
    const attemptRef = useRef(0);

    useEffect(() => {
        if (!open) return;
        setStep('brief');
        setError(null);
        setDraft(null);
        setConfirmDiscard(false);
        setResumable(readStoredDraft());
        if (defaultPackageSessionId)
            setBatches([{ id: defaultPackageSessionId, label: t('composer.thisBatch') }]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Mirror the draft under review so a reload or a closed dialog does not lose it.
    useEffect(() => {
        if (step !== 'review' || !draft) return;
        writeStoredDraft(snapshot(draft));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        step,
        draft,
        creditsSpent,
        batches,
        topic,
        startTime,
        endTime,
        revealTime,
        language,
        difficulty,
        mix,
    ]);

    function snapshot(current: AiPlanDraft): StoredAiDraft {
        return {
            v: 1,
            savedAt: Date.now(),
            draft: current,
            creditsSpent,
            batches,
            topic,
            startTime,
            endTime,
            revealTime,
            language,
            difficulty,
            mix,
        };
    }

    /** Closing mid-generation or mid-review would throw away paid work: confirm first. */
    function handleOpenChange(next: boolean) {
        // The plan is being written; closing now would hide whether it was created.
        if (!next && saving) return;
        if (!next && (step === 'generating' || (step === 'review' && draft))) {
            setConfirmDiscard(true);
            return;
        }
        onOpenChange(next);
    }

    function discardDraft() {
        attemptRef.current += 1;
        // A draft abandoned mid-flight must not be replayed by the next attempt's key.
        if (step === 'generating') setDraftKey(newIdempotencyKey('engagement-draft'));
        clearStoredDraft();
        setResumable(null);
        setDraft(null);
        setCreditsSpent(0);
        setStep('brief');
        setConfirmDiscard(false);
        onOpenChange(false);
    }

    function resumeDraft(stored: StoredAiDraft) {
        setDraft(stored.draft);
        setCreditsSpent(stored.creditsSpent);
        setBatches(stored.batches);
        setTopic(stored.topic);
        setStartTime(stored.startTime);
        setEndTime(stored.endTime);
        setRevealTime(stored.revealTime);
        setLanguage(stored.language);
        setDifficulty(stored.difficulty);
        setMix(stored.mix);
        setLastGrounding([]);
        setSelectedDay(0);
        setResumable(null);
        setError(null);
        setStep('review');
    }

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
        if (batches.length === 0) return setError(t('wizard.errors.batch'));
        if (!topic.trim() && chapterIds.length === 0) {
            return setError(t('wizard.errors.topic'));
        }
        if (enabledCount === 0) return setError(t('wizard.errors.kinds'));
        setError(null);
        setStep('generating');
        const attempt = ++attemptRef.current;
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
            // Discarded while it was being written: drop it.
            if (attempt !== attemptRef.current) return;
            setDraft(result);
            setCreditsSpent(DRAFT_CREDITS);
            setResumable(null);
            setSelectedDay(0);
            setStep('review');
        } catch (e: unknown) {
            const message =
                (e as { response?: { data?: { detail?: string; message?: string } } })?.response
                    ?.data?.detail ??
                (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                t('wizard.errors.draft');
            if (attempt !== attemptRef.current) return;
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
            setCreditsSpent((c) => c + res.images_generated * IMAGE_CREDITS);
        } catch (e: unknown) {
            setError(
                (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                    t('wizard.errors.pictures')
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
            setCreditsSpent((c) => c + ITEM_CREDITS);
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
                    t('wizard.errors.regenerate')
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
            clearStoredDraft();
            setDraft(null);
            setCreditsSpent(0);
            setStep('brief');
            onCreated();
            onOpenChange(false);
        } catch (e: unknown) {
            setError(
                (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                    t('wizard.errors.save')
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
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-screen w-full overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-start">
                        <Sparkle size={18} className="text-primary-500" />
                        {step === 'review' ? t('wizard.review') : t('wizard.title')}
                    </DialogTitle>
                </DialogHeader>

                {step === 'brief' && (
                    <div className="space-y-5">
                        {resumable && (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
                                <div className="flex min-w-0 items-start gap-2">
                                    <ClockCounterClockwise
                                        size={18}
                                        className="mt-0.5 shrink-0 text-primary-500"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-neutral-900">
                                            {t('wizard.resume.title')}
                                        </p>
                                        <p className="truncate text-xs text-neutral-600">
                                            {t('wizard.resume.body', {
                                                title: resumable.draft.title,
                                                when: formatAgo(resumable.savedAt, i18n.language),
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <MyButton
                                        type="button"
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() => {
                                            clearStoredDraft();
                                            setResumable(null);
                                            setDraft(null);
                                            setCreditsSpent(0);
                                        }}
                                    >
                                        {t('wizard.resume.discard')}
                                    </MyButton>
                                    <MyButton
                                        type="button"
                                        scale="small"
                                        onClick={() => resumeDraft(resumable)}
                                    >
                                        {t('wizard.resume.action')}
                                    </MyButton>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>{t('wizard.batches')}</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 w-full justify-start font-normal"
                                    onClick={() => setBatchPickerOpen(true)}
                                >
                                    {batches.length === 0
                                        ? t('wizard.selectBatches')
                                        : batches.length === 1
                                          ? batches[0]!.label
                                          : t('wizard.batchesSelected', {
                                                count: batches.length,
                                            })}
                                </Button>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="ai-title">{t('wizard.planTitle')}</Label>
                                <Input
                                    id="ai-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={t('wizard.planTitlePlaceholder')}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="ai-topic">{t('wizard.topic')}</Label>
                            <Textarea
                                id="ai-topic"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                rows={3}
                                placeholder={t('wizard.topicPlaceholder')}
                            />
                        </div>

                        <div className="rounded-lg border border-neutral-200 p-4">
                            <p className="text-sm font-medium text-neutral-900">
                                {t('wizard.ground')}
                            </p>
                            <p className="mt-0.5 text-xs text-neutral-500">
                                {t('wizard.groundHint')}
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>{t('wizard.subject')}</Label>
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
                                                        ? t('wizard.pickBatchFirst')
                                                        : t('wizard.selectSubject')
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
                                    <Label>{t('wizard.chapters')}</Label>
                                    <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
                                        {chapters.length === 0 && (
                                            <p className="px-1 py-2 text-xs text-neutral-500">
                                                {subjectId
                                                    ? t('wizard.loadingChapters')
                                                    : t('wizard.pickSubject')}
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
                                {t('wizard.shape')}
                            </p>
                            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-1.5">
                                    <Label>{t('wizard.duration')}</Label>
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
                                                {t(d.key)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-start">{t('wizard.starts')}</Label>
                                    <Input
                                        id="ai-start"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>{t('wizard.perDay')}</Label>
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
                                    <Label>{t('wizard.difficulty')}</Label>
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
                                            <SelectItem value="easy">{t('wizard.easy')}</SelectItem>
                                            <SelectItem value="medium">
                                                {t('wizard.medium')}
                                            </SelectItem>
                                            <SelectItem value="hard">{t('wizard.hard')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-open">{t('wizard.opensAt')}</Label>
                                    <Input
                                        id="ai-open"
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-close">{t('wizard.closesAt')}</Label>
                                    <Input
                                        id="ai-close"
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-reveal">{t('wizard.revealAt')}</Label>
                                    <Input
                                        id="ai-reveal"
                                        type="time"
                                        value={revealTime}
                                        onChange={(e) => setRevealTime(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-lang">{t('wizard.language')}</Label>
                                    <Input
                                        id="ai-lang"
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 space-y-1.5">
                                <Label>{t('wizard.kinds')}</Label>
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {TASK_KINDS.map((key) => (
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
                                                    {t(KIND_LABEL_KEY[key])}
                                                </span>
                                                <span className="block text-xs text-neutral-500">
                                                    {t(`${KIND_LABEL_KEY[key]}_hint`)}
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
                            {t('wizard.generating', { count: days })}
                        </p>
                        <p className="max-w-md text-xs text-neutral-500">
                            {t('wizard.generatingHint')}
                        </p>
                    </div>
                )}

                {step === 'review' && draft && (
                    <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)_20rem]">
                        {/* Days */}
                        <div className="space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                {`${t('wizard.days', { count: draft.slots.length })} · ${t(
                                    'wizard.tasks',
                                    { count: totalItems }
                                )}`}
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
                                        {formatSlotDate(slot.startDate, i18n.language)}
                                    </span>
                                    <span className="block truncate text-sm font-medium text-neutral-900">
                                        {slot.title}
                                    </span>
                                    <span className="block text-xs text-neutral-500">
                                        {t('wizard.tasks', { count: (slot.items ?? []).length })}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Tasks for the selected day */}
                        <div className="space-y-3">
                            {!draft.grounded && (
                                <p className="rounded-md bg-warning-50 px-3 py-2 text-xs text-warning-700">
                                    {t('wizard.ungrounded')}
                                </p>
                            )}
                            {(draft.slots[selectedDay]?.items ?? []).map((item, ii) => {
                                const placeholders = countImagePlaceholders(item.contentHtml);
                                const key = `${selectedDay}-${ii}`;
                                const format = questionFormat(item);
                                return (
                                    <div
                                        key={key}
                                        className="space-y-2 rounded-lg border border-neutral-200 p-3"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <span className="inline-flex items-center gap-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                                                    <span
                                                        aria-hidden="true"
                                                        className={cn(
                                                            'size-2 rounded-full',
                                                            ENGAGEMENT_TYPE_ACCENT[item.itemType] ??
                                                                'bg-neutral-400'
                                                        )}
                                                    />
                                                    {t(`composer.types.${item.itemType}`)}
                                                    {format === 'TEXT' || format === 'UPLOAD'
                                                        ? ` · ${t(`composer.formats.${format}`)}`
                                                        : ''}
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
                                                aria-label={t('wizard.removeTask')}
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
                                                ? t('wizard.regenerating')
                                                : t('wizard.regenerate', { credits: ITEM_CREDITS })}
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
                                                    ? t('wizard.generatingPictures')
                                                    : t('wizard.addPictures', {
                                                          count: Math.min(placeholders, 2),
                                                          credits:
                                                              Math.min(placeholders, 2) *
                                                              IMAGE_CREDITS,
                                                      })}
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
                                {t('wizard.cost', { credits: DRAFT_CREDITS })}
                            </p>
                            <MyButton type="button" onClick={generate}>
                                <Sparkle size={16} /> {t('wizard.draft')}
                            </MyButton>
                        </>
                    )}
                    {step === 'review' && (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    // The draft stays on offer from the brief step.
                                    if (draft) setResumable(snapshot(draft));
                                    setStep('brief');
                                }}
                            >
                                {t('wizard.back')}
                            </Button>
                            <span className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={saving}
                                    onClick={() => publish('DRAFT')}
                                >
                                    {t('wizard.saveDraft')}
                                </Button>
                                <MyButton
                                    type="button"
                                    disable={saving || totalItems === 0}
                                    onClick={() => publish('PUBLISHED')}
                                >
                                    {saving
                                        ? t('wizard.publishing')
                                        : t('wizard.publish', { count: batches.length })}
                                </MyButton>
                            </span>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>

            <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('wizard.discard.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {step === 'generating'
                                ? t('wizard.discard.generating', { count: DRAFT_CREDITS })
                                : t('wizard.discard.charged', { count: creditsSpent })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('wizard.discard.keep')}</AlertDialogCancel>
                        {/* A reviewed draft can go to the server as a DRAFT plan instead of
                            being thrown away; publish() closes the wizard when it lands. */}
                        {step === 'review' && draft && (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={saving}
                                onClick={() => {
                                    setConfirmDiscard(false);
                                    void publish('DRAFT');
                                }}
                            >
                                {t('wizard.saveDraft')}
                            </Button>
                        )}
                        <AlertDialogAction
                            className="bg-danger-600 text-white hover:bg-danger-500"
                            onClick={discardDraft}
                        >
                            {t('wizard.discard.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
