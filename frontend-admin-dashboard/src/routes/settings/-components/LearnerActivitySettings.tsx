import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

// ─── Types ───────────────────────────────────────────────────────────────────
// Mirrors frontend-learner-dashboard-app/src/services/learner-tracking-settings.ts.
// The learner app deep-merges whatever is stored here over the same defaults,
// so partial/older blobs stay safe.

interface LearnerActivitySettingsData {
    completion: {
        slideCompletionThresholdPercent: number;
    };
    documents: {
        pageDwellSeconds: number;
        actionDwellSeconds: number;
        readingTime: {
            enabled: boolean;
            wordsPerMinute: number;
            minSeconds: number;
            maxSeconds: number;
        };
    };
    focus: {
        idlePopupEnabled: boolean;
        idlePopupDelaySeconds: number;
        hardPauseMinutes: number;
    };
}

const DEFAULT_SETTINGS: LearnerActivitySettingsData = {
    completion: {
        slideCompletionThresholdPercent: 80,
    },
    documents: {
        pageDwellSeconds: 10,
        actionDwellSeconds: 5,
        readingTime: {
            enabled: true,
            wordsPerMinute: 200,
            minSeconds: 10,
            maxSeconds: 600,
        },
    },
    focus: {
        idlePopupEnabled: true,
        idlePopupDelaySeconds: 60,
        hardPauseMinutes: 5,
    },
};

const SETTING_KEY = 'LEARNER_TRACKING_SETTING';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

// ─── API ─────────────────────────────────────────────────────────────────────

const mergeWithDefaults = (
    partial: Partial<LearnerActivitySettingsData> | null | undefined
): LearnerActivitySettingsData => ({
    completion: { ...DEFAULT_SETTINGS.completion, ...partial?.completion },
    documents: {
        ...DEFAULT_SETTINGS.documents,
        ...partial?.documents,
        readingTime: {
            ...DEFAULT_SETTINGS.documents.readingTime,
            ...partial?.documents?.readingTime,
        },
    },
    focus: { ...DEFAULT_SETTINGS.focus, ...partial?.focus },
});

const fetchSettings = async (): Promise<LearnerActivitySettingsData> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INSITITUTE_SETTINGS,
        params: { instituteId, settingKey: SETTING_KEY },
    });
    return mergeWithDefaults(response.data?.data);
};

const saveSettings = async (data: LearnerActivitySettingsData): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Learner Activity Settings', setting_data: data },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
};

// ─── Small helpers ───────────────────────────────────────────────────────────

interface NumberFieldProps {
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
    suffix?: string;
    help: string;
    disabled?: boolean;
    onChange: (value: number) => void;
}

function NumberField({
    id,
    label,
    value,
    min,
    max,
    suffix,
    help,
    disabled,
    onChange,
}: NumberFieldProps) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    type="number"
                    min={min}
                    max={max}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) onChange(n);
                    }}
                    className="max-w-28"
                />
                {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
            </div>
            <p className="text-xs text-muted-foreground">{help}</p>
        </div>
    );
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// ─── Component ───────────────────────────────────────────────────────────────

export default function LearnerActivitySettings() {
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<LearnerActivitySettingsData>(DEFAULT_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);
    const learnerLabel = getTerminology(RoleTerms.Learner, SystemTerms.Learner);
    const slideLabel = getTerminology(ContentTerms.Slide, SystemTerms.Slide);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['learner-activity-settings'],
        queryFn: fetchSettings,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setSettings(data);
            setHasChanges(false);
        }
    }, [data]);

    const update = (updater: (prev: LearnerActivitySettingsData) => LearnerActivitySettingsData) => {
        setSettings(updater);
        setHasChanges(true);
    };

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveSettings,
        onSuccess: () => {
            toast.success('Learner activity settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['learner-activity-settings'] });
        },
        onError: () => {
            toast.error('Failed to save learner activity settings');
        },
    });

    const handleSave = () => {
        // Clamp to the same bounds the learner app enforces so what admins
        // see is what learners get.
        const s = settings;
        save({
            completion: {
                slideCompletionThresholdPercent: clamp(
                    s.completion.slideCompletionThresholdPercent,
                    1,
                    100
                ),
            },
            documents: {
                pageDwellSeconds: clamp(s.documents.pageDwellSeconds, 1, 600),
                actionDwellSeconds: clamp(s.documents.actionDwellSeconds, 1, 600),
                readingTime: {
                    enabled: s.documents.readingTime.enabled,
                    wordsPerMinute: clamp(s.documents.readingTime.wordsPerMinute, 50, 1000),
                    minSeconds: clamp(s.documents.readingTime.minSeconds, 1, 3600),
                    maxSeconds: clamp(
                        Math.max(
                            s.documents.readingTime.maxSeconds,
                            s.documents.readingTime.minSeconds
                        ),
                        10,
                        7200
                    ),
                },
            },
            focus: {
                idlePopupEnabled: s.focus.idlePopupEnabled,
                idlePopupDelaySeconds: clamp(s.focus.idlePopupDelaySeconds, 10, 3600),
                hardPauseMinutes: clamp(s.focus.hardPauseMinutes, 1, 120),
            },
        });
    };

    if (isLoading) {
        return (
            <div className="p-6 text-sm text-muted-foreground">
                Loading learner activity settings…
            </div>
        );
    }
    if (isError) {
        return (
            <div className="p-6 text-sm text-muted-foreground">
                Could not load learner activity settings. Please refresh and try again.
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Completion Threshold</CardTitle>
                    <CardDescription>
                        Controls when a {slideLabel.toLowerCase()} or chapter shows as completed
                        (green tick) in the {learnerLabel.toLowerCase()} app. Progress
                        percentages themselves are unaffected — this is the display cutoff.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <NumberField
                        id="completion-threshold"
                        label="Mark as complete at"
                        value={settings.completion.slideCompletionThresholdPercent}
                        min={1}
                        max={100}
                        suffix="% progress"
                        help="Default 80%. Certificates use their own threshold under Certificate Settings."
                        onChange={(v) =>
                            update((p) => ({
                                ...p,
                                completion: { ...p.completion, slideCompletionThresholdPercent: v },
                            }))
                        }
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Reading &amp; Documents</CardTitle>
                    <CardDescription>
                        How long a {learnerLabel.toLowerCase()} must actually spend on document
                        content before it counts as viewed.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <NumberField
                        id="page-dwell"
                        label="Minimum time per page"
                        value={settings.documents.pageDwellSeconds}
                        min={1}
                        max={600}
                        suffix="seconds"
                        help="A PDF/document page flicked past faster than this does not count as viewed. Default 10s."
                        onChange={(v) =>
                            update((p) => ({
                                ...p,
                                documents: { ...p.documents, pageDwellSeconds: v },
                            }))
                        }
                    />
                    <NumberField
                        id="action-dwell"
                        label="Minimum time per action"
                        value={settings.documents.actionDwellSeconds}
                        min={1}
                        max={600}
                        suffix="seconds"
                        help="Applies to interactive slides (Jupyter, Scratch, Code editor). Default 5s."
                        onChange={(v) =>
                            update((p) => ({
                                ...p,
                                documents: { ...p.documents, actionDwellSeconds: v },
                            }))
                        }
                    />

                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                            <Switch
                                id="reading-time-enabled"
                                checked={settings.documents.readingTime.enabled}
                                onCheckedChange={(v) =>
                                    update((p) => ({
                                        ...p,
                                        documents: {
                                            ...p.documents,
                                            readingTime: { ...p.documents.readingTime, enabled: v },
                                        },
                                    }))
                                }
                            />
                            <div>
                                <Label htmlFor="reading-time-enabled" className="cursor-pointer">
                                    Content-aware reading time
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Long single-page documents require time proportional to their
                                    length before counting as read — a 3,000-word page is no
                                    longer &quot;done&quot; in 10 seconds. Recommended on.
                                </p>
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <NumberField
                                id="reading-wpm"
                                label="Reading speed"
                                value={settings.documents.readingTime.wordsPerMinute}
                                min={50}
                                max={1000}
                                suffix="words/min"
                                disabled={!settings.documents.readingTime.enabled}
                                help="Default 200 wpm."
                                onChange={(v) =>
                                    update((p) => ({
                                        ...p,
                                        documents: {
                                            ...p.documents,
                                            readingTime: {
                                                ...p.documents.readingTime,
                                                wordsPerMinute: v,
                                            },
                                        },
                                    }))
                                }
                            />
                            <NumberField
                                id="reading-min"
                                label="Minimum"
                                value={settings.documents.readingTime.minSeconds}
                                min={1}
                                max={3600}
                                suffix="seconds"
                                disabled={!settings.documents.readingTime.enabled}
                                help="Floor for very short notes. Default 10s."
                                onChange={(v) =>
                                    update((p) => ({
                                        ...p,
                                        documents: {
                                            ...p.documents,
                                            readingTime: {
                                                ...p.documents.readingTime,
                                                minSeconds: v,
                                            },
                                        },
                                    }))
                                }
                            />
                            <NumberField
                                id="reading-max"
                                label="Maximum"
                                value={settings.documents.readingTime.maxSeconds}
                                min={10}
                                max={7200}
                                suffix="seconds"
                                disabled={!settings.documents.readingTime.enabled}
                                help="Cap for very long pages. Default 600s (10 min)."
                                onChange={(v) =>
                                    update((p) => ({
                                        ...p,
                                        documents: {
                                            ...p.documents,
                                            readingTime: {
                                                ...p.documents.readingTime,
                                                maxSeconds: v,
                                            },
                                        },
                                    }))
                                }
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Focus &amp; Idle Detection</CardTitle>
                    <CardDescription>
                        The &quot;are you still there?&quot; check and automatic pause that stop
                        idle time from counting as study time on document slides. Video check-in
                        frequency is configured under Display Settings → Concentration.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="idle-popup-enabled"
                            checked={settings.focus.idlePopupEnabled}
                            onCheckedChange={(v) =>
                                update((p) => ({
                                    ...p,
                                    focus: { ...p.focus, idlePopupEnabled: v },
                                }))
                            }
                        />
                        <div>
                            <Label htmlFor="idle-popup-enabled" className="cursor-pointer">
                                Show attention check on inactivity
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                When off, no popup is shown; tracking still auto-pauses after the
                                hard pause below.
                            </p>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <NumberField
                            id="idle-delay"
                            label="Show check after"
                            value={settings.focus.idlePopupDelaySeconds}
                            min={10}
                            max={3600}
                            suffix="seconds idle"
                            disabled={!settings.focus.idlePopupEnabled}
                            help="No mouse/keyboard/touch activity for this long triggers the check. Default 60s."
                            onChange={(v) =>
                                update((p) => ({
                                    ...p,
                                    focus: { ...p.focus, idlePopupDelaySeconds: v },
                                }))
                            }
                        />
                        <NumberField
                            id="hard-pause"
                            label="Hard pause after"
                            value={settings.focus.hardPauseMinutes}
                            min={1}
                            max={120}
                            suffix="minutes idle"
                            help="Tracking always pauses after this much inactivity, popup or not. Default 5 min."
                            onChange={(v) =>
                                update((p) => ({
                                    ...p,
                                    focus: { ...p.focus, hardPauseMinutes: v },
                                }))
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={handleSave}
                    disable={saving || !hasChanges}
                >
                    {saving ? 'Saving…' : 'Save Learner Activity Settings'}
                </MyButton>
            </div>
        </div>
    );
}
