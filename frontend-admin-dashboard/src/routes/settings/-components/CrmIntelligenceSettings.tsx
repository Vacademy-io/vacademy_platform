import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { MyButton } from '@/components/design-system/button';
import { Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

// ─── Types (mirror admin-core CrmIntelligenceSettingsPojo) ─────────────────────
// Stored under the institute's CRM_INTELLIGENCE_SETTING JSON. Gates which call
// recordings get transcribed + AI-analyzed, and tunes how the two ratings score.

type CallSource = 'MANUAL' | 'TELEPHONY' | 'AI';

interface RubricSettings {
    objectiveHint: string | null;
    qualities: string[];
    weights?: Record<string, number> | null;
}

interface CallsSettings {
    enabled: boolean;
    sources: Record<CallSource, boolean>;
    minDurationSeconds: number;
    analyzeNotConnected: boolean;
    /** null = use the DB-managed global price (credit_pricing 'call_intelligence'). */
    creditCostOverride: number | null;
    ratingScale: number;
    rubric: RubricSettings;
}

interface CrmIntelligenceSettingsData {
    enabled: boolean;
    calls: CallsSettings;
}

const DEFAULT_RUBRIC: RubricSettings = {
    objectiveHint: null,
    qualities: ['rapport', 'needs_discovery', 'objection_handling', 'next_step_secured'],
    weights: null,
};

/**
 * Plain-English, sales-team definitions for the common rubric qualities — shown
 * under each field so admins know exactly what the AI grades. Keyed by the
 * normalized quality (lowercase, spaces → underscores). Custom qualities an
 * institute adds simply won't have a hint (that's fine — the term itself guides
 * the AI). Add new well-known sales terms here as they come up.
 */
const QUALITY_DESCRIPTIONS: Record<string, string> = {
    rapport: 'Building trust early — warm opening, using the lead’s name, matching their tone.',
    needs_discovery:
        'Asking questions to uncover the lead’s goals, situation and pain before pitching.',
    objection_handling:
        'Acknowledging and resolving concerns (price, timing, trust) instead of talking past them.',
    next_step_secured:
        'Locking a concrete next action — demo booked, callback time set, payment link sent.',
    value_articulation: 'Explaining the offering’s value in terms relevant to this lead’s needs.',
    pitch_clarity: 'Presenting the course/offer clearly and concisely, without rambling.',
    active_listening:
        'Letting the lead speak, not interrupting, and reflecting back what they said.',
    urgency_creation:
        'Giving a genuine reason to act now (limited seats, deadline, current offer).',
    closing: 'Asking for the commitment and driving toward a clear decision.',
    talk_listen_balance: 'A healthy talk-vs-listen ratio — not dominating the call.',
    follow_up_commitment: 'Getting the lead to agree to a specific follow-up, not a vague “maybe”.',
    tone_confidence: 'Speaking with confidence, energy and professionalism throughout.',
};

const qualityDescription = (q: string): string | undefined =>
    QUALITY_DESCRIPTIONS[q.trim().toLowerCase().replace(/\s+/g, '_')];

const DEFAULT_CALLS: CallsSettings = {
    enabled: false,
    sources: { MANUAL: true, TELEPHONY: true, AI: true },
    minDurationSeconds: 20,
    analyzeNotConnected: false,
    creditCostOverride: null,
    ratingScale: 10,
    rubric: DEFAULT_RUBRIC,
};

const DEFAULT_SETTINGS: CrmIntelligenceSettingsData = {
    enabled: false,
    calls: DEFAULT_CALLS,
};

const SOURCE_LABELS: { key: CallSource; label: string; help: string }[] = [
    {
        key: 'MANUAL',
        label: 'Manual uploads',
        help: 'Recordings a counsellor uploads for an off-platform call.',
    },
    {
        key: 'TELEPHONY',
        label: 'Telephony calls',
        help: 'Calls placed through Exotel / Airtel etc.',
    },
    { key: 'AI', label: 'AI agent calls', help: 'Calls placed by the AI voice agent (Aavtaar).' },
];

const SETTING_KEY = 'CRM_INTELLIGENCE_SETTING';
const GET_URL = `${BASE_URL}/admin-core-service/institute/setting/v1/get`;
const SAVE_URL = `${BASE_URL}/admin-core-service/institute/setting/v1/save-setting`;

const fetchSettings = async (): Promise<CrmIntelligenceSettingsData> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_URL,
        params: { instituteId, settingKey: SETTING_KEY },
    });
    const saved = response.data?.data as Partial<CrmIntelligenceSettingsData> | undefined;
    if (!saved) return DEFAULT_SETTINGS;
    // Deep-merge the calls + rubric blocks so a partial saved doc keeps defaults.
    return {
        ...DEFAULT_SETTINGS,
        ...saved,
        calls: {
            ...DEFAULT_CALLS,
            ...(saved.calls ?? {}),
            sources: { ...DEFAULT_CALLS.sources, ...(saved.calls?.sources ?? {}) },
            rubric: { ...DEFAULT_RUBRIC, ...(saved.calls?.rubric ?? {}) },
        },
    };
};

const saveSettings = async (data: CrmIntelligenceSettingsData): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'CRM Intelligence Settings', setting_data: data },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
};

export default function CrmIntelligenceSettings() {
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<CrmIntelligenceSettingsData>(DEFAULT_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['crm-intelligence-settings'],
        queryFn: fetchSettings,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setSettings(data);
            setHasChanges(false);
        }
    }, [data]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveSettings,
        onSuccess: () => {
            toast.success('CRM intelligence settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['crm-intelligence-settings'] });
        },
        onError: () => toast.error('Failed to save CRM intelligence settings'),
    });

    const update = (patch: Partial<CrmIntelligenceSettingsData>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
        setHasChanges(true);
    };
    const updateCalls = (patch: Partial<CallsSettings>) => {
        setSettings((prev) => ({ ...prev, calls: { ...prev.calls, ...patch } }));
        setHasChanges(true);
    };
    const updateRubric = (patch: Partial<RubricSettings>) => {
        setSettings((prev) => ({
            ...prev,
            calls: { ...prev.calls, rubric: { ...prev.calls.rubric, ...patch } },
        }));
        setHasChanges(true);
    };

    const toggleSource = (key: CallSource, on: boolean) =>
        updateCalls({ sources: { ...settings.calls.sources, [key]: on } });

    const setQuality = (i: number, value: string) =>
        updateRubric({
            qualities: settings.calls.rubric.qualities.map((q, idx) => (idx === i ? value : q)),
        });
    const addQuality = () => updateRubric({ qualities: [...settings.calls.rubric.qualities, ''] });
    const removeQuality = (i: number) =>
        updateRubric({ qualities: settings.calls.rubric.qualities.filter((_, idx) => idx !== i) });

    const handleSave = () => {
        // Trim empty rubric qualities before persisting.
        const cleaned: CrmIntelligenceSettingsData = {
            ...settings,
            calls: {
                ...settings.calls,
                rubric: {
                    ...settings.calls.rubric,
                    objectiveHint: settings.calls.rubric.objectiveHint?.trim() || null,
                    qualities: settings.calls.rubric.qualities.map((q) => q.trim()).filter(Boolean),
                },
            },
        };
        save(cleaned);
    };

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle>CRM Intelligence</CardTitle>
                    <CardDescription>
                        When enabled, call recordings are automatically transcribed (Hindi &amp;
                        English) and analyzed by AI — producing a summary, action items, an outcome
                        status, and two 0–10 ratings (how well the caller advanced their goal, and
                        how the call landed for the lead). Each analyzed call deducts AI credits.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="crm-intel-enabled"
                            checked={settings.enabled}
                            onCheckedChange={(v) => update({ enabled: v })}
                        />
                        <Label htmlFor="crm-intel-enabled" className="cursor-pointer">
                            {settings.enabled ? 'Enabled' : 'Disabled'}
                        </Label>
                    </div>
                </CardContent>
            </Card>

            {settings.enabled && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Call Analysis</CardTitle>
                            <CardDescription>
                                Choose which call sources are analyzed and the thresholds that gate
                                it.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="calls-enabled"
                                    checked={settings.calls.enabled}
                                    onCheckedChange={(v) => updateCalls({ enabled: v })}
                                />
                                <Label htmlFor="calls-enabled" className="cursor-pointer">
                                    Analyze call recordings
                                </Label>
                            </div>

                            {settings.calls.enabled && (
                                <>
                                    <Separator />
                                    <div className="space-y-3">
                                        <Label>Sources</Label>
                                        {SOURCE_LABELS.map((s) => (
                                            <div key={s.key} className="flex items-start gap-3">
                                                <Switch
                                                    id={`src-${s.key}`}
                                                    checked={settings.calls.sources[s.key]}
                                                    onCheckedChange={(v) => toggleSource(s.key, v)}
                                                />
                                                <div className="grid gap-0.5">
                                                    <Label
                                                        htmlFor={`src-${s.key}`}
                                                        className="cursor-pointer"
                                                    >
                                                        {s.label}
                                                    </Label>
                                                    <p className="text-caption text-muted-foreground">
                                                        {s.help}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <Separator />

                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="min-duration">
                                                Minimum call seconds
                                            </Label>
                                            <Input
                                                id="min-duration"
                                                type="number"
                                                min={0}
                                                max={600}
                                                value={settings.calls.minDurationSeconds}
                                                onChange={(e) =>
                                                    updateCalls({
                                                        minDurationSeconds:
                                                            parseInt(e.target.value, 10) || 0,
                                                    })
                                                }
                                                className="w-28"
                                            />
                                            <p className="text-caption text-muted-foreground">
                                                Skip calls shorter than this — usually voicemail
                                                blips.
                                            </p>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="credit-override">
                                                Credit cost per call (override)
                                            </Label>
                                            <Input
                                                id="credit-override"
                                                type="number"
                                                min={0}
                                                placeholder="Default"
                                                value={settings.calls.creditCostOverride ?? ''}
                                                onChange={(e) =>
                                                    updateCalls({
                                                        creditCostOverride:
                                                            e.target.value === ''
                                                                ? null
                                                                : Number(e.target.value),
                                                    })
                                                }
                                                className="w-28"
                                            />
                                            <p className="text-caption text-muted-foreground">
                                                Leave blank to use the platform default price.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Switch
                                            id="analyze-not-connected"
                                            checked={settings.calls.analyzeNotConnected}
                                            onCheckedChange={(v) =>
                                                updateCalls({ analyzeNotConnected: v })
                                            }
                                        />
                                        <Label
                                            htmlFor="analyze-not-connected"
                                            className="cursor-pointer"
                                        >
                                            Also analyze calls that didn’t connect
                                        </Label>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {settings.calls.enabled && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Scoring Rubric</CardTitle>
                                <CardDescription>
                                    These are the sales-call skills the AI grades each rep on. The
                                    call objective is inferred from the conversation (an optional
                                    hint nudges it); each quality below is scored 0–10 within the
                                    caller’s rating, and drives the “Skill breakdown” in Coaching.
                                    Changes apply to calls analyzed after you save — use
                                    “Re-analyze” on a past call to rescore it against a new rubric.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid max-w-xl gap-2">
                                    <Label htmlFor="objective-hint">
                                        Objective hint (optional)
                                    </Label>
                                    <Input
                                        id="objective-hint"
                                        value={settings.calls.rubric.objectiveHint ?? ''}
                                        placeholder="e.g. book a campus demo"
                                        onChange={(e) =>
                                            updateRubric({ objectiveHint: e.target.value })
                                        }
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label>Rated qualities</Label>
                                    {settings.calls.rubric.qualities.map((q, i) => {
                                        const desc = qualityDescription(q);
                                        return (
                                            <div key={i} className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        value={q}
                                                        placeholder="e.g. objection_handling"
                                                        onChange={(e) =>
                                                            setQuality(i, e.target.value)
                                                        }
                                                        className="max-w-md flex-1"
                                                    />
                                                    <MyButton
                                                        buttonType="secondary"
                                                        scale="medium"
                                                        onClick={() => removeQuality(i)}
                                                    >
                                                        <Trash className="size-4" />
                                                    </MyButton>
                                                </div>
                                                <p className="max-w-md text-caption text-muted-foreground">
                                                    {desc ??
                                                        'Custom skill — the AI grades it by the term itself. Use a clear sales term (e.g. closing, urgency_creation).'}
                                                </p>
                                            </div>
                                        );
                                    })}
                                    <MyButton
                                        buttonType="secondary"
                                        scale="medium"
                                        onClick={addQuality}
                                    >
                                        <Plus className="size-4" /> Add quality
                                    </MyButton>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            <div className="flex items-center justify-end">
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={handleSave}
                    disable={saving || !hasChanges || isLoading}
                >
                    {saving ? 'Saving…' : 'Save CRM intelligence settings'}
                </MyButton>
            </div>
        </div>
    );
}
