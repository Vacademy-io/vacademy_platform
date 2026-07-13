import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import LeadStatusesManager from './LeadStatusesManager';
import LeadSlaSettings from './LeadSlaSettings';
import LeadReportSettings from './LeadReportSettings';
import LeadDedupSettings from './LeadDedupSettings';
import PoolsList from './pools/PoolsList';
// LOCAL ONLY — these power the Workbench tab where admins pick the leads team
// and configure the counsellor rating strategy.
import { CounsellorRatingSettings } from './CounsellorRatingSettings';

// ─── Types ───────────────────────────────────────────────────────────────────
// NOTE: Lead statuses and TAT/Follow-up SLA config now live in dedicated DB tables
// (LeadStatusesManager + LeadSlaSettings). The LEAD_SETTING JSON only keeps the
// scoring/visibility config below.

export interface LeadSettingsData {
    /** If false, all lead-related UI (scores, tiers, sidebar tab) is hidden across the institute. */
    enabled: boolean;

    /** Scoring factor weights. Must sum to 100. */
    scoringWeights: {
        sourceQuality: number;
        profileCompleteness: number;
        recency: number;
        engagement: number;
    };

    /** Max days before recency score starts decaying. */
    recencyDecayDays: number;

    showScoreInEnquiryTable: boolean;
    showScoreInContactsTable: boolean;
    showScoreInStudentsTable: boolean;
}

const DEFAULT_LEAD_SETTINGS: LeadSettingsData = {
    enabled: true,
    scoringWeights: {
        sourceQuality: 25,
        profileCompleteness: 30,
        recency: 25,
        engagement: 20,
    },
    recencyDecayDays: 30,
    showScoreInEnquiryTable: true,
    showScoreInContactsTable: true,
    showScoreInStudentsTable: true,
};

const SETTING_KEY = 'LEAD_SETTING';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

// ─── API ─────────────────────────────────────────────────────────────────────

const fetchLeadSettings = async (): Promise<LeadSettingsData> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INSITITUTE_SETTINGS,
        params: { instituteId, settingKey: SETTING_KEY },
    });
    const saved = response.data?.data?.[SETTING_KEY]?.data as Partial<LeadSettingsData> | undefined;
    if (!saved) return DEFAULT_LEAD_SETTINGS;
    return {
        ...DEFAULT_LEAD_SETTINGS,
        ...saved,
        scoringWeights: { ...DEFAULT_LEAD_SETTINGS.scoringWeights, ...saved.scoringWeights },
    };
};

const saveLeadSettings = async (data: LeadSettingsData): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Lead Settings', setting_data: data },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
};

function weightsSum(w: LeadSettingsData['scoringWeights']): number {
    return w.sourceQuality + w.profileCompleteness + w.recency + w.engagement;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeadSettings() {
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<LeadSettingsData>(DEFAULT_LEAD_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['lead-settings'],
        queryFn: fetchLeadSettings,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setSettings(data);
            setHasChanges(false);
        }
    }, [data]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveLeadSettings,
        onSuccess: () => {
            toast.success('Lead settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['lead-settings'] });
            queryClient.invalidateQueries({ queryKey: ['lead-settings-config'] });
        },
        onError: () => {
            toast.error('Failed to save lead settings');
        },
    });

    const update = (patch: Partial<LeadSettingsData>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
        setHasChanges(true);
    };

    const updateWeight = (key: keyof LeadSettingsData['scoringWeights'], value: number) => {
        setSettings((prev) => ({
            ...prev,
            scoringWeights: { ...prev.scoringWeights, [key]: value },
        }));
        setHasChanges(true);
    };

    const handleSave = () => {
        const total = weightsSum(settings.scoringWeights);
        if (total !== 100) {
            toast.error(`Scoring weights must sum to 100 (current: ${total})`);
            return;
        }
        save(settings);
    };

    const weightTotal = weightsSum(settings.scoringWeights);
    const weightError = weightTotal !== 100;

    return (
        <div className="p-6">
            <Tabs defaultValue="config" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="config">Configuration</TabsTrigger>
                    <TabsTrigger value="pools">Pools</TabsTrigger>
                    <TabsTrigger value="workbench">Workbench</TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="space-y-6">
                    {isLoading ? (
                        <div className="text-sm text-muted-foreground">Loading lead settings…</div>
                    ) : (
                        <ConfigSection
                            settings={settings}
                            update={update}
                            updateWeight={updateWeight}
                            weightTotal={weightTotal}
                            weightError={weightError}
                            handleSave={handleSave}
                            saving={saving}
                            hasChanges={hasChanges}
                        />
                    )}
                </TabsContent>

                <TabsContent value="pools">
                    <PoolsList />
                </TabsContent>

                <TabsContent value="workbench" className="space-y-6">
                    <CounsellorRatingSettings />
                </TabsContent>
            </Tabs>
        </div>
    );
}

interface ConfigSectionProps {
    settings: LeadSettingsData;
    update: (patch: Partial<LeadSettingsData>) => void;
    updateWeight: (key: keyof LeadSettingsData['scoringWeights'], value: number) => void;
    weightTotal: number;
    weightError: boolean;
    handleSave: () => void;
    saving: boolean;
    hasChanges: boolean;
}

function ConfigSection({
    settings,
    update,
    updateWeight,
    weightTotal,
    weightError,
    handleSave,
    saving,
    hasChanges,
}: ConfigSectionProps) {
    return (
        <div className="space-y-6">
            {/* ── Enable / Disable Lead System ── */}
            <Card>
                <CardHeader>
                    <CardTitle>Lead Management System</CardTitle>
                    <CardDescription>
                        Controls whether lead scoring, tier badges, and the lead sidebar tab are
                        visible institute-wide. Disabling hides all lead UI without deleting data.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <Switch
                            id="lead-enabled"
                            checked={settings.enabled}
                            onCheckedChange={(v) => update({ enabled: v })}
                        />
                        <Label htmlFor="lead-enabled" className="cursor-pointer">
                            {settings.enabled ? 'Enabled' : 'Disabled'}
                        </Label>
                    </div>
                </CardContent>
            </Card>

            {settings.enabled && (
                <>
                    {/* ── Score Badge Visibility ── */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Score Badge Visibility</CardTitle>
                            <CardDescription>
                                Choose where the HOT / WARM / COLD score badge appears.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {(
                                [
                                    [
                                        'showScoreInEnquiryTable',
                                        'Enquiries table (Admissions → Enquiries)',
                                    ],
                                    [
                                        'showScoreInContactsTable',
                                        'Contacts table (Manage Contacts)',
                                    ],
                                    [
                                        'showScoreInStudentsTable',
                                        'Students table (Manage Students)',
                                    ],
                                ] as [keyof LeadSettingsData, string][]
                            ).map(([key, label]) => (
                                <div key={key} className="flex items-center gap-3">
                                    <Switch
                                        id={key}
                                        checked={settings[key] as boolean}
                                        onCheckedChange={(v) => update({ [key]: v })}
                                    />
                                    <Label htmlFor={key} className="cursor-pointer">
                                        {label}
                                    </Label>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* ── Scoring Weights ── */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Scoring Weights</CardTitle>
                            <CardDescription>
                                Each factor contributes its weight percentage to the final score
                                (0–100). Weights must sum to exactly 100.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {(
                                [
                                    [
                                        'sourceQuality',
                                        'Source Quality',
                                        'Score based on how the lead came in (e.g. Walk-in > Google Ads > Manual)',
                                    ],
                                    [
                                        'profileCompleteness',
                                        'Profile Completeness',
                                        'Percentage of key fields filled (name, email, phone, class, etc.)',
                                    ],
                                    [
                                        'recency',
                                        'Recency',
                                        'Time decay — newer leads score higher, older ones decay',
                                    ],
                                    [
                                        'engagement',
                                        'Engagement',
                                        'Number of timeline notes and interactions recorded',
                                    ],
                                ] as [keyof LeadSettingsData['scoringWeights'], string, string][]
                            ).map(([key, label, desc]) => (
                                <div
                                    key={key}
                                    className="grid grid-cols-[1fr_80px] items-start gap-4"
                                >
                                    <div>
                                        <p className="text-sm font-medium">{label}</p>
                                        <p className="text-xs text-muted-foreground">{desc}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={settings.scoringWeights[key]}
                                            onChange={(e) =>
                                                updateWeight(key, parseInt(e.target.value, 10) || 0)
                                            }
                                            className="w-16 text-center"
                                        />
                                        <span className="text-sm text-muted-foreground">%</span>
                                    </div>
                                </div>
                            ))}

                            <Separator />

                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">Total</span>
                                <span
                                    className={
                                        weightError
                                            ? 'font-bold text-danger-600'
                                            : 'font-bold text-success-600'
                                    }
                                >
                                    {weightTotal} / 100
                                    {weightError && ' — must equal 100'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Recency Decay ── */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recency Decay</CardTitle>
                            <CardDescription>
                                Number of days before a lead&apos;s recency score starts to decay
                                toward 0. A lead submitted today scores 100 for recency; one
                                submitted {settings.recencyDecayDays} days ago scores ~50.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={settings.recencyDecayDays}
                                    onChange={(e) =>
                                        update({
                                            recencyDecayDays: parseInt(e.target.value, 10) || 30,
                                        })
                                    }
                                    className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">days</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Score / visibility save (its own action; statuses + reminders save separately) ── */}
                    <div className="flex items-center justify-end">
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={handleSave}
                            disable={saving || !hasChanges}
                        >
                            {saving ? 'Saving…' : 'Save scoring settings'}
                        </MyButton>
                    </div>

                    {/* ── Reports Center config (LEAD_SETTING.data.reports subtree) ── */}
                    <LeadReportSettings />

                    {/* ── Lead uniqueness / deduplication (LEAD_SETTING.data.dedup subtree) ── */}
                    <LeadDedupSettings />

                    {/* ── TAT + Follow-up reminders (table-backed) ── */}
                    <LeadSlaSettings />

                    {/* ── Lead Statuses (table-backed CRUD) ── */}
                    <LeadStatusesManager />
                </>
            )}
        </div>
    );
}
