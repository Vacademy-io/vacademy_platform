import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    ArrowsClockwise,
    ChalkboardTeacher,
    CircleNotch,
    Eye,
    FloppyDisk,
    Sparkle,
    WarningCircle,
} from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MyButton } from '@/components/design-system/button';
import { getPackageSettingData, savePackageSettingKey } from '@/services/package-settings';
import {
    TUTOR_MODE_SETTING_KEY,
    compileTutorPlans,
    getTutorPlans,
    newCompileRunId,
    putTutorSourceDescription,
    recompileTutorSlide,
    type TutorCompileEvent,
    type TutorModeSetting,
    type TutorPackagePlans,
    type TutorPlanStatus,
    type TutorPlanStatusItem,
} from '@/services/tutor';
import { TutorPlanPreviewDialog } from './TutorPlanPreviewDialog';

interface TutorModeTabProps {
    packageId: string;
}

const DEFAULT_SETTING: Required<
    Pick<
        TutorModeSetting,
        'enabled' | 'defaultOn' | 'teacherName' | 'ttsProvider' | 'sessionLanguage' | 'strictness'
    >
> &
    TutorModeSetting = {
    enabled: false,
    defaultOn: true,
    teacherName: 'Asha',
    ttsProvider: 'smallest',
    ttsVoice: '',
    languages: ['en', 'hi'],
    sessionLanguage: 'course',
    llmModel: '',
    compileModel: '',
    strictness: 'normal',
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
    READY: { label: 'Ready', tone: 'bg-success-50 text-success-700 border-success-200' },
    COMPILING: { label: 'Compiling', tone: 'bg-primary-50 text-primary-700 border-primary-200' },
    NEEDS_DETAILS: { label: 'Needs details', tone: 'bg-warning-50 text-warning-700 border-warning-200' },
    STALE: { label: 'Stale', tone: 'bg-warning-50 text-warning-700 border-warning-200' },
    FAILED: { label: 'Failed', tone: 'bg-danger-50 text-danger-700 border-danger-200' },
    NOT_COMPILED: { label: 'Not prepared', tone: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
    UNSUPPORTED: { label: 'Not supported', tone: 'bg-neutral-100 text-neutral-500 border-neutral-200' },
    DELETED: { label: 'Deleted', tone: 'bg-neutral-100 text-neutral-500 border-neutral-200' },
};

const StatusBadge: React.FC<{ status: TutorPlanStatus | string }> = ({ status }) => {
    const s = STATUS_LABEL[status] ?? { label: status, tone: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
    return (
        <Badge variant="outline" className={s.tone}>
            {s.label}
        </Badge>
    );
};

const isMediaSlide = (t: string | null) => t === 'VIDEO' || t === 'HTML_VIDEO' || t === 'DOCUMENT';

/**
 * Course page → Tutor Mode tab (docs/ai-tutor/LIVE_TUTOR_DESIGN.md §5.3, BUILD_PLAN WP3).
 *
 * Two cards: the per-course TUTOR_MODE_SETTING (enable, default on, teacher,
 * voice, models) and the teaching-plan status of every slide with "Prepare for
 * teaching" (compiles what is missing or stale), per-slide recompile, a
 * "what this video / PDF teaches" editor for slides parked in NEEDS_DETAILS,
 * and a read-only preview of any compiled plan.
 */
export const TutorModeTab: React.FC<TutorModeTabProps> = ({ packageId }) => {
    // ── settings ──
    const [setting, setSetting] = useState<TutorModeSetting>(DEFAULT_SETTING);
    const [settingLoading, setSettingLoading] = useState(true);
    const [settingSaving, setSettingSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    // ── plans ──
    const [plans, setPlans] = useState<TutorPackagePlans | null>(null);
    const [plansLoading, setPlansLoading] = useState(true);
    const [compiling, setCompiling] = useState(false);
    const [progress, setProgress] = useState<Record<string, TutorCompileEvent>>({});
    const [previewSlide, setPreviewSlide] = useState<TutorPlanStatusItem | null>(null);
    const [detailsFor, setDetailsFor] = useState<TutorPlanStatusItem | null>(null);
    const [detailsText, setDetailsText] = useState('');
    const [detailsSaving, setDetailsSaving] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const loadSetting = useCallback(async () => {
        setSettingLoading(true);
        try {
            const data = (await getPackageSettingData(packageId, TUTOR_MODE_SETTING_KEY)) as
                | TutorModeSetting
                | null;
            if (data && typeof data === 'object') setSetting({ ...DEFAULT_SETTING, ...data });
        } catch {
            /* absent key: defaults */
        } finally {
            setSettingLoading(false);
        }
    }, [packageId]);

    const loadPlans = useCallback(async () => {
        setPlansLoading(true);
        try {
            setPlans(await getTutorPlans(packageId));
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Could not load teaching plans');
        } finally {
            setPlansLoading(false);
        }
    }, [packageId]);

    useEffect(() => {
        void loadSetting();
        void loadPlans();
        return () => abortRef.current?.abort();
    }, [loadSetting, loadPlans]);

    const update = <K extends keyof TutorModeSetting>(key: K, value: TutorModeSetting[K]) => {
        setSetting((s) => ({ ...s, [key]: value }));
        setDirty(true);
    };

    const saveSetting = async () => {
        setSettingSaving(true);
        try {
            await savePackageSettingKey(packageId, TUTOR_MODE_SETTING_KEY, setting, 'Tutor Mode');
            setDirty(false);
            toast.success('Tutor mode settings saved');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Could not save settings');
        } finally {
            setSettingSaving(false);
        }
    };

    const onEvent = useCallback((ev: TutorCompileEvent) => {
        if (ev.slide_id) setProgress((p) => ({ ...p, [ev.slide_id as string]: ev }));
        if (ev.type === 'ERROR') toast.error(ev.message || 'Compile error');
    }, []);

    const runCompile = async (slideIds?: string[]) => {
        if (compiling) return;
        setCompiling(true);
        setProgress({});
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const opts = {
                language: (setting.languages?.[0] as 'en' | 'hi') || 'en',
                teacher_name: setting.teacherName || 'Asha',
                compile_run_id: newCompileRunId(),
            };
            if (slideIds && slideIds.length === 1) {
                await recompileTutorSlide(slideIds[0]!, opts, onEvent, controller.signal);
            } else {
                await compileTutorPlans(packageId, { ...opts, slide_ids: slideIds ?? [] }, onEvent, controller.signal);
            }
            toast.success('Teaching plans updated');
        } catch (e: unknown) {
            if (!(e instanceof DOMException && e.name === 'AbortError')) {
                toast.error(e instanceof Error ? e.message : 'Compile failed');
            }
        } finally {
            setCompiling(false);
            abortRef.current = null;
            void loadPlans();
        }
    };

    const saveDetails = async () => {
        if (!detailsFor) return;
        setDetailsSaving(true);
        try {
            await putTutorSourceDescription(detailsFor.slide_id, detailsText.trim());
            toast.success('Saved. Compiling this slide…');
            const id = detailsFor.slide_id;
            setDetailsFor(null);
            setDetailsText('');
            await runCompile([id]);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Could not save details');
        } finally {
            setDetailsSaving(false);
        }
    };

    const counts = plans?.counts ?? {};
    const supported = useMemo(
        () => (plans?.slides ?? []).filter((s) => s.status !== 'UNSUPPORTED'),
        [plans]
    );
    const pending = useMemo(
        () => supported.filter((s) => ['NOT_COMPILED', 'STALE', 'FAILED'].includes(s.status)).length,
        [supported]
    );
    const needsDetails = useMemo(() => supported.filter((s) => s.status === 'NEEDS_DETAILS'), [supported]);
    const ready = counts.READY ?? 0;

    return (
        <div className="space-y-4 p-2">
            {/* ── settings ── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <ChalkboardTeacher className="size-5 text-primary-500" />
                        AI teacher for this course
                        {settingLoading && <CircleNotch className="size-4 animate-spin text-neutral-400" />}
                    </CardTitle>
                    <p className="text-sm text-neutral-500">
                        Learners are taught one-to-one from the compiled teaching plans below. Fields left
                        blank use the institute defaults from Settings → Course settings.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-6">
                        <label className="flex items-center gap-2 text-sm">
                            <Switch checked={!!setting.enabled} onCheckedChange={(v) => update('enabled', v)} />
                            Tutor mode enabled
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <Switch
                                checked={!!setting.defaultOn}
                                disabled={!setting.enabled}
                                onCheckedChange={(v) => update('defaultOn', v)}
                            />
                            Start learners in teaching mode
                        </label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="space-y-1">
                            <Label>Teacher name</Label>
                            <Input
                                value={setting.teacherName ?? ''}
                                maxLength={60}
                                placeholder="Asha"
                                onChange={(e) => update('teacherName', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Course language</Label>
                            <Select
                                value={setting.languages?.[0] ?? 'en'}
                                onValueChange={(v) => update('languages', [v, v === 'en' ? 'hi' : 'en'])}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="hi">Hindi</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Session language</Label>
                            <Select
                                value={setting.sessionLanguage ?? 'course'}
                                onValueChange={(v) => update('sessionLanguage', v as 'course' | 'learner')}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="course">Course language (learner may switch)</SelectItem>
                                    <SelectItem value="learner">Learner&apos;s preference</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Voice provider</Label>
                            <Select
                                value={setting.ttsProvider ?? 'smallest'}
                                onValueChange={(v) => update('ttsProvider', v as TutorModeSetting['ttsProvider'])}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="smallest">Smallest.ai</SelectItem>
                                    <SelectItem value="sarvam">Sarvam</SelectItem>
                                    <SelectItem value="google">Google</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Voice</Label>
                            <Input
                                value={setting.ttsVoice ?? ''}
                                placeholder="institute default"
                                onChange={(e) => update('ttsVoice', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Strictness</Label>
                            <Select
                                value={setting.strictness ?? 'normal'}
                                onValueChange={(v) => update('strictness', v as TutorModeSetting['strictness'])}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gentle">Gentle</SelectItem>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="strict">Strict</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Live model (LLM)</Label>
                            <Input
                                value={setting.llmModel ?? ''}
                                placeholder="institute default"
                                onChange={(e) => update('llmModel', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Compile model</Label>
                            <Input
                                value={setting.compileModel ?? ''}
                                placeholder="platform default"
                                onChange={(e) => update('compileModel', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            layoutVariant="default"
                            disable={!dirty || settingSaving}
                            onClick={() => void saveSetting()}
                        >
                            {settingSaving ? <CircleNotch className="size-4 animate-spin" /> : <FloppyDisk className="size-4" />}
                            Save settings
                        </MyButton>
                    </div>
                </CardContent>
            </Card>

            {/* ── plans ── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        <Sparkle className="size-5 text-primary-500" />
                        Teaching plans
                        {plansLoading && <CircleNotch className="size-4 animate-spin text-neutral-400" />}
                        <span className="ml-auto flex flex-wrap gap-1">
                            {Object.entries(counts).map(([k, v]) => (
                                <span key={k} className="inline-flex items-center gap-1 text-xs">
                                    <StatusBadge status={k} /> {v}
                                </span>
                            ))}
                        </span>
                    </CardTitle>
                    <p className="text-sm text-neutral-500">
                        {ready} of {supported.length} teachable slides are ready.{' '}
                        {pending > 0 && `${pending} still need preparing. `}
                        {needsDetails.length > 0 &&
                            `${needsDetails.length} video/PDF slide(s) need a short description of what they teach.`}
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            layoutVariant="default"
                            disable={compiling || plansLoading}
                            onClick={() => void runCompile()}
                        >
                            {compiling ? <CircleNotch className="size-4 animate-spin" /> : <Sparkle className="size-4" />}
                            {compiling ? 'Preparing…' : 'Prepare for teaching'}
                        </MyButton>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            layoutVariant="default"
                            disable={compiling || plansLoading}
                            onClick={() => void loadPlans()}
                        >
                            <ArrowsClockwise className="size-4" /> Refresh
                        </MyButton>
                        {compiling && (
                            <MyButton
                                buttonType="secondary"
                                scale="medium"
                                layoutVariant="default"
                                onClick={() => abortRef.current?.abort()}
                            >
                                Stop
                            </MyButton>
                        )}
                        <span className="text-xs text-neutral-500">
                            Each document or video slide costs about 2 credits to prepare; quizzes are free.
                            Already-prepared slides are skipped.
                        </span>
                    </div>

                    {detailsFor && (
                        <div className="space-y-2 rounded-md border border-warning-200 bg-warning-50 p-3">
                            <Label className="text-sm font-medium">
                                What does “{detailsFor.slide_title}” teach?
                            </Label>
                            <p className="text-xs text-neutral-600">
                                The AI teacher cannot read a video or PDF. Describe the points it covers (3–10
                                sentences); the teacher will ask the learner to watch or read it, then check
                                those points.
                            </p>
                            <Textarea
                                value={detailsText}
                                rows={5}
                                maxLength={8000}
                                onChange={(e) => setDetailsText(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <MyButton
                                    buttonType="primary"
                                    scale="small"
                                    layoutVariant="default"
                                    disable={detailsText.trim().length < 10 || detailsSaving}
                                    onClick={() => void saveDetails()}
                                >
                                    {detailsSaving ? <CircleNotch className="size-4 animate-spin" /> : null}
                                    Save and prepare
                                </MyButton>
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    layoutVariant="default"
                                    onClick={() => setDetailsFor(null)}
                                >
                                    Cancel
                                </MyButton>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                                    <th className="py-2 pr-3">Chapter</th>
                                    <th className="py-2 pr-3">Slide</th>
                                    <th className="py-2 pr-3">Type</th>
                                    <th className="py-2 pr-3">Status</th>
                                    <th className="py-2 pr-3">Plan</th>
                                    <th className="py-2 pr-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(plans?.slides ?? []).map((s) => {
                                    const live = progress[s.slide_id];
                                    const liveStatus =
                                        live?.type === 'PLAN_STARTED'
                                            ? 'COMPILING'
                                            : live?.type === 'PLAN_READY'
                                              ? 'READY'
                                              : live?.type === 'PLAN_ERROR'
                                                ? 'FAILED'
                                                : live?.type === 'PLAN_NEEDS_DETAILS'
                                                  ? 'NEEDS_DETAILS'
                                                  : null;
                                    const status = liveStatus ?? s.status;
                                    return (
                                        <tr key={s.slide_id} className="border-b border-neutral-100 align-top">
                                            <td className="py-2 pr-3 text-neutral-600">{s.chapter_name ?? '—'}</td>
                                            <td className="py-2 pr-3 font-medium text-neutral-800">
                                                {s.slide_title ?? s.slide_id}
                                                {(s.error || live?.error) && (
                                                    <p className="mt-0.5 flex items-start gap-1 text-xs font-normal text-danger-600">
                                                        <WarningCircle className="mt-0.5 size-3 shrink-0" />
                                                        {live?.error ?? s.error}
                                                    </p>
                                                )}
                                                {live?.reason && (
                                                    <p className="mt-0.5 text-xs font-normal text-neutral-500">{live.reason}</p>
                                                )}
                                            </td>
                                            <td className="py-2 pr-3 text-neutral-600">{s.source_type ?? '—'}</td>
                                            <td className="py-2 pr-3">
                                                <StatusBadge status={status} />
                                            </td>
                                            <td className="py-2 pr-3 text-neutral-600">
                                                {s.topics > 0 ? `${s.topics} boards · ${s.concepts} concepts` : '—'}
                                                {s.version ? <span className="text-neutral-400"> · v{s.version}</span> : null}
                                            </td>
                                            <td className="py-2 pr-0 text-right">
                                                <div className="flex justify-end gap-1">
                                                    {s.serving_plan_id && (
                                                        <button
                                                            type="button"
                                                            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-primary-600"
                                                            title="Preview teaching plan"
                                                            onClick={() => setPreviewSlide(s)}
                                                        >
                                                            <Eye className="size-4" />
                                                        </button>
                                                    )}
                                                    {(s.status === 'NEEDS_DETAILS' ||
                                                        (isMediaSlide(s.source_type) && s.source_type !== 'DOCUMENT')) && (
                                                        <button
                                                            type="button"
                                                            className="rounded-md px-2 py-1 text-xs text-warning-700 hover:bg-warning-50"
                                                            onClick={() => {
                                                                setDetailsFor(s);
                                                                setDetailsText('');
                                                            }}
                                                        >
                                                            Add details
                                                        </button>
                                                    )}
                                                    {s.status !== 'UNSUPPORTED' && (
                                                        <button
                                                            type="button"
                                                            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-primary-600 disabled:opacity-50"
                                                            title="Recompile this slide"
                                                            disabled={compiling}
                                                            onClick={() => void runCompile([s.slide_id])}
                                                        >
                                                            <ArrowsClockwise className="size-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!plansLoading && (plans?.slides ?? []).length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-6 text-center text-neutral-500">
                                            This course has no slides yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <TutorPlanPreviewDialog
                slideId={previewSlide?.slide_id ?? null}
                slideTitle={previewSlide?.slide_title}
                onClose={() => setPreviewSlide(null)}
            />
        </div>
    );
};
