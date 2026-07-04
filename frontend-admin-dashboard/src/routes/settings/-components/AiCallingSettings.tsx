import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MyButton } from '@/components/design-system/button';
import { Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { AiAgentsCard } from './AiAgentsCard';

// ─── Types ───────────────────────────────────────────────────────────────────
// Stored under the institute's AI_CALLING_SETTING JSON. The backend EVALUATE
// node reads this to decide, per call outcome, whether to assign a counsellor or
// keep retrying. Recording + AI summary are shown on the lead profile first;
// assignment only happens when these rules say so.

type AssignmentMode = 'ROUND_ROBIN' | 'TIME_BASED' | 'MANUAL';

/** One calling window. `start`/`end` are "HH:mm" (24h, institute timezone). */
export interface Shift {
    start: string;
    end: string;
}

/** Direction of an AI campaign: we dial the lead (Outbound), or the lead dials our AI line (Inbound). */
export type CampaignDirection = 'OUTBOUND' | 'INBOUND';

/**
 * One registered AI campaign. `name` is the provider-agnostic agent a workflow author
 * picks (e.g. "Class Feedback"); `campaignId` is the raw id `provider` uses for it; the
 * same `name` can repeat once per provider so switching provider resolves to the right id.
 * Inbound-tagged ids also let the backend classify an incoming webhook (matched by phone).
 */
export interface Campaign {
    campaignId: string;
    name: string;
    direction: CampaignDirection;
    /** Provider this campaign id belongs to (e.g. AAVTAAR). Blank ⇒ any provider. */
    provider?: string;
}

export interface AiCallingSettingsData {
    /** Master switch — when off, no AI calls are placed for this institute. */
    enabled: boolean;
    /**
     * Show the manual "AI call" robot button in lead lists. Independent of
     * `enabled`: turning this off only hides the icon — AI workflows keep running.
     */
    showInLeadList: boolean;
    /** AI-voice provider code (e.g. "AAVTAAR"). Selects which backend adapter places calls. */
    provider: string;
    /** Provider campaign id (AI script/persona) used for outbound AI calls. */
    defaultCampaignId: string;
    /**
     * Campaign registry: every provider campaign id this institute uses, each tagged
     * Inbound or Outbound. Inbound-tagged ids classify incoming AI-call webhooks (the
     * lead dialed our AI line); the rest are informational/outbound.
     */
    campaigns: Campaign[];
    /** A call shorter than this (seconds) counts as "didn't really connect" → retry. */
    connectThresholdSec: number;

    // Retry policy
    maxRetries: number;
    maxCallsPerDayPerLead: number;
    /** Minutes the bot waits before re-dialing a no-answer lead. */
    retryGapMinutes: number;
    /** Minutes before re-checking a lead deferred (outside shift / at the day cap). */
    recheckMinutes: number;
    /** Time windows the bot may (re)dial in — supports multiple shifts. */
    callingShifts: Shift[];
    timezone: string; // e.g. "Asia/Kolkata"

    // Outcome → action. Dispositions in neither list are retried until max, then
    // assigned to a human.
    assignOnDispositions: string[];
    stopOnDispositions: string[];

    // Counsellor assignment
    assignmentMode: AssignmentMode;
    assignExhaustedToHuman: boolean;

    /**
     * Auto-capture unknown INBOUND callers as leads. When the AI helpline answers a
     * caller whose number isn't already a lead, a lead is created (or matched) so the
     * call is followable in Recent Leads + the Call Log. Off by default.
     */
    inboundLeadCapture: { enabled: boolean };
}

const DISPOSITIONS = [
    'Interested',
    'Likely_Interested',
    'Callback',
    'Requirement_Not_Clear',
    'Incomplete',
    'Not_Interested',
] as const;

const ASSIGNMENT_MODES: { value: AssignmentMode; label: string }[] = [
    { value: 'ROUND_ROBIN', label: 'Round robin' },
    { value: 'TIME_BASED', label: 'On-shift only' },
    { value: 'MANUAL', label: 'Manual' },
];

const DEFAULT_AI_CALLING_SETTINGS: AiCallingSettingsData = {
    enabled: false,
    showInLeadList: false,
    provider: 'AAVTAAR',
    defaultCampaignId: '',
    campaigns: [],
    connectThresholdSec: 20,
    maxRetries: 3,
    maxCallsPerDayPerLead: 3,
    retryGapMinutes: 120,
    recheckMinutes: 30,
    callingShifts: [{ start: '09:00', end: '21:00' }],
    timezone: 'Asia/Kolkata',
    assignOnDispositions: ['Interested', 'Likely_Interested'],
    stopOnDispositions: ['Not_Interested'],
    assignmentMode: 'ROUND_ROBIN',
    assignExhaustedToHuman: true,
    inboundLeadCapture: { enabled: false },
};

const SETTING_KEY = 'AI_CALLING_SETTING';
const GET_URL = `${BASE_URL}/admin-core-service/institute/setting/v1/get`;
const SAVE_URL = `${BASE_URL}/admin-core-service/institute/setting/v1/save-setting`;

// ─── Provider metadata ─────────────────────────────────────────────────────────
// Per-provider UI copy. The list of selectable providers comes from the backend
// (what's actually wired). Adding an entry here gives a provider nicer labels; any
// provider the backend reports that isn't listed falls back to generic labels — so
// a new AI agent works out-of-the-box with no UI change required.
interface ProviderMeta {
    label: string;
    companyCodeLabel: string;
    companyCodePlaceholder: string;
    tokenLabel: string;
    tokenPlaceholder: string;
    campaignPlaceholder: string;
    campaignHelp: string;
}
const PROVIDER_META: Record<string, ProviderMeta> = {
    AAVTAAR: {
        label: 'Aavtaar',
        companyCodeLabel: 'Company Code',
        companyCodePlaceholder: 'Your provider company code',
        tokenLabel: 'Bearer Token',
        tokenPlaceholder: 'Paste the API token',
        campaignPlaceholder: 'Campaign ID from your provider',
        campaignHelp:
            'The campaign that defines the AI script/persona for outbound calls. Provided by your AI-calling provider.',
    },
    VACADEMY_AI: {
        label: 'Vacademy AI Agent',
        companyCodeLabel: 'Account Code',
        companyCodePlaceholder: 'Not needed — calls run on your Vacademy Voice number',
        tokenLabel: 'API Token',
        tokenPlaceholder: 'Not needed for Vacademy AI',
        campaignPlaceholder: 'Pick an agent from the AI Agents section below',
        campaignHelp:
            'Vacademy AI agents are authored in the "AI Agents" section below — saving one registers it here automatically (its id is the campaign id).',
    },
};
const titleCase = (code: string) =>
    code ? code.charAt(0).toUpperCase() + code.slice(1).toLowerCase() : 'Provider';
const metaFor = (code: string): ProviderMeta =>
    PROVIDER_META[code] ?? {
        label: titleCase(code),
        companyCodeLabel: 'Account / Company Code',
        companyCodePlaceholder: 'Your provider account code',
        tokenLabel: 'API Token',
        tokenPlaceholder: 'Paste the API token',
        campaignPlaceholder: 'Campaign / agent ID',
        campaignHelp: 'The campaign or agent that defines the AI script for outbound calls.',
    };
const webhookPathFor = (code: string) =>
    code === 'AAVTAAR'
        ? '…/telephony/webhook/aavtaar'
        : `…/telephony/webhook/ai-voice/${(code || '').toLowerCase()}`;

const PROVIDERS_URL = `${BASE_URL}/admin-core-service/v1/telephony/ai-config/meta/providers`;
/** Providers the backend has wired. Falls back to Aavtaar if the endpoint isn't up yet. */
const fetchProviders = async (): Promise<string[]> => {
    try {
        const { data } = await authenticatedAxiosInstance.get<string[]>(PROVIDERS_URL);
        return Array.isArray(data) && data.length ? data : ['AAVTAAR'];
    } catch {
        return ['AAVTAAR'];
    }
};

// ─── API ─────────────────────────────────────────────────────────────────────

const fetchAiCallingSettings = async (): Promise<AiCallingSettingsData> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_URL,
        params: { instituteId, settingKey: SETTING_KEY },
    });
    // `/get` returns a SettingDto shape: { key, name, data } — the saved settings
    // live at response.data.data, NOT nested again under the settingKey.
    const saved = response.data?.data as
        | (Partial<AiCallingSettingsData> & { windowStart?: string; windowEnd?: string })
        | undefined;
    if (!saved) return DEFAULT_AI_CALLING_SETTINGS;
    const merged = { ...DEFAULT_AI_CALLING_SETTINGS, ...saved };
    // Migrate the legacy single window → one shift when shifts weren't saved yet.
    if ((!saved.callingShifts || saved.callingShifts.length === 0) && (saved.windowStart || saved.windowEnd)) {
        merged.callingShifts = [
            { start: saved.windowStart ?? '09:00', end: saved.windowEnd ?? '21:00' },
        ];
    }
    return merged;
};

const saveAiCallingSettings = async (data: AiCallingSettingsData): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'AI Calling Settings', setting_data: data },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
};

// ─── Credentials (encrypted, stored in institute_telephony_config) ─────────────
interface AiConfigView {
    companyCode: string | null;
    enabled: boolean;
    hasToken: boolean;
    hasWebhookSecret: boolean;
}
interface AiConfigSave {
    companyCode: string;
    apiToken?: string;
    webhookSecret?: string;
}
const AI_CONFIG_URL = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/ai-config/${instituteId}`;

const fetchAiConfig = async (): Promise<AiConfigView> => {
    const instituteId = getCurrentInstituteId() ?? '';
    const { data } = await authenticatedAxiosInstance.get<AiConfigView>(AI_CONFIG_URL(instituteId));
    return data;
};

const saveAiConfig = async (payload: AiConfigSave): Promise<void> => {
    const instituteId = getCurrentInstituteId() ?? '';
    await authenticatedAxiosInstance.put(AI_CONFIG_URL(instituteId), payload);
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AiCallingSettings() {
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<AiCallingSettingsData>(DEFAULT_AI_CALLING_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['ai-calling-settings'],
        queryFn: fetchAiCallingSettings,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setSettings(data);
            setHasChanges(false);
        }
    }, [data]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveAiCallingSettings,
        onSuccess: () => {
            toast.success('AI calling settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['ai-calling-settings'] });
        },
        onError: () => {
            toast.error('Failed to save AI calling settings');
        },
    });

    // ── Credentials (separate from the policy JSON; stored encrypted) ──
    const { data: cfg } = useQuery({
        queryKey: ['ai-calling-config'],
        queryFn: fetchAiConfig,
        staleTime: 5 * 60 * 1000,
    });

    // Providers the backend actually has wired (drives the picker — never hardcoded).
    const { data: providerCodes = ['AAVTAAR'] } = useQuery({
        queryKey: ['ai-voice-providers'],
        queryFn: fetchProviders,
        staleTime: 30 * 60 * 1000,
    });
    const [companyCode, setCompanyCode] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    useEffect(() => {
        if (cfg) setCompanyCode(cfg.companyCode ?? '');
    }, [cfg]);

    const { mutate: saveCreds, isPending: savingCreds } = useMutation({
        mutationFn: saveAiConfig,
        onSuccess: () => {
            toast.success('Credentials saved');
            setApiToken('');
            setWebhookSecret('');
            queryClient.invalidateQueries({ queryKey: ['ai-calling-config'] });
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Failed to save credentials');
        },
    });

    const handleSaveCreds = () => {
        const m = metaFor(settings.provider);
        if (!companyCode.trim()) {
            toast.error(`${m.companyCodeLabel} is required.`);
            return;
        }
        if (!cfg?.hasToken && !apiToken.trim()) {
            toast.error(`${m.tokenLabel} is required.`);
            return;
        }
        saveCreds({
            companyCode: companyCode.trim(),
            apiToken: apiToken.trim() || undefined,
            webhookSecret: webhookSecret.trim() || undefined,
        });
    };

    const update = (patch: Partial<AiCallingSettingsData>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
        setHasChanges(true);
    };

    const toggleDisposition = (
        field: 'assignOnDispositions' | 'stopOnDispositions',
        disposition: string,
        on: boolean
    ) => {
        setSettings((prev) => {
            const current = new Set(prev[field]);
            if (on) current.add(disposition);
            else current.delete(disposition);
            // A disposition can't be both "assign" and "stop" — clear the other side.
            const other = field === 'assignOnDispositions' ? 'stopOnDispositions' : 'assignOnDispositions';
            const otherSet = new Set(prev[other]);
            if (on) otherSet.delete(disposition);
            return { ...prev, [field]: Array.from(current), [other]: Array.from(otherSet) };
        });
        setHasChanges(true);
    };

    const addShift = () => {
        setSettings((prev) => ({
            ...prev,
            callingShifts: [...prev.callingShifts, { start: '09:00', end: '13:00' }],
        }));
        setHasChanges(true);
    };

    const removeShift = (index: number) => {
        setSettings((prev) => ({
            ...prev,
            callingShifts: prev.callingShifts.filter((_, i) => i !== index),
        }));
        setHasChanges(true);
    };

    const updateShift = (index: number, patch: Partial<Shift>) => {
        setSettings((prev) => ({
            ...prev,
            callingShifts: prev.callingShifts.map((s, i) => (i === index ? { ...s, ...patch } : s)),
        }));
        setHasChanges(true);
    };

    const addCampaign = () => {
        setSettings((prev) => ({
            ...prev,
            campaigns: [
                ...(prev.campaigns ?? []),
                { campaignId: '', name: '', direction: 'OUTBOUND', provider: prev.provider },
            ],
        }));
        setHasChanges(true);
    };

    const removeCampaign = (index: number) => {
        setSettings((prev) => ({
            ...prev,
            campaigns: (prev.campaigns ?? []).filter((_, i) => i !== index),
        }));
        setHasChanges(true);
    };

    const updateCampaign = (index: number, patch: Partial<Campaign>) => {
        setSettings((prev) => ({
            ...prev,
            campaigns: (prev.campaigns ?? []).map((c, i) => (i === index ? { ...c, ...patch } : c)),
        }));
        setHasChanges(true);
    };

    // Saving/deleting a Vacademy AI agent bridges its campaign entry into
    // AI_CALLING_SETTING server-side. Mirror that into the LOCAL unsaved state
    // (same replace-by-campaignId logic as the backend bridge, no setHasChanges)
    // so a later "Save changes" on this screen doesn't clobber the bridged entry.
    const mirrorBridgedCampaign = (c: Campaign) => {
        setSettings((prev) => ({
            ...prev,
            campaigns: [
                ...(prev.campaigns ?? []).filter((x) => x.campaignId !== c.campaignId),
                c,
            ],
        }));
    };
    const mirrorRemovedCampaign = (agentId: string) => {
        setSettings((prev) => ({
            ...prev,
            campaigns: (prev.campaigns ?? []).filter((x) => x.campaignId !== agentId),
        }));
    };

    const handleSave = () => {
        if (settings.enabled && !settings.defaultCampaignId.trim()) {
            toast.error('A default Campaign ID is required to enable AI calling.');
            return;
        }
        save(settings);
    };

    const meta = metaFor(settings.provider);
    const webhookPath = webhookPathFor(settings.provider);

    return (
        <div className="space-y-6 p-6">
            {/* ── Enable + Campaign ── */}
            <Card>
                <CardHeader>
                    <CardTitle>AI Calling</CardTitle>
                    <CardDescription>
                        When enabled, leads are first called by the AI voice agent. The recording and
                        AI summary appear on the lead profile, and a counsellor is assigned only when
                        the outcome rules below say so.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="ai-calling-enabled"
                            checked={settings.enabled}
                            onCheckedChange={(v) => update({ enabled: v })}
                        />
                        <Label htmlFor="ai-calling-enabled" className="cursor-pointer">
                            {settings.enabled ? 'Enabled' : 'Disabled'}
                        </Label>
                    </div>

                    <Separator />

                    <div className="flex items-center gap-3">
                        <Switch
                            id="ai-show-in-lead-list"
                            checked={settings.showInLeadList}
                            onCheckedChange={(v) => update({ showInLeadList: v })}
                        />
                        <Label htmlFor="ai-show-in-lead-list" className="cursor-pointer">
                            Show the AI-call button on lead rows
                        </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Controls only the manual robot button in lead lists. Automated AI workflows
                        run regardless of this toggle.
                    </p>

                    <Separator />

                    <div className="flex items-center gap-3">
                        <Switch
                            id="ai-inbound-lead-capture"
                            checked={settings.inboundLeadCapture?.enabled ?? false}
                            onCheckedChange={(v) => update({ inboundLeadCapture: { enabled: v } })}
                        />
                        <Label htmlFor="ai-inbound-lead-capture" className="cursor-pointer">
                            Capture inbound callers as leads
                        </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        For an inbound AI helpline: when someone calls and isn't already a lead, a lead
                        is created (matched by phone, so repeat callers aren&apos;t duplicated) and the
                        call attaches to it — so it shows in Recent Leads and the Call Log, and you can
                        follow up. Off means unknown callers&apos; calls are recorded but no lead is made.
                    </p>

                    <Separator />

                    <div className="grid max-w-md gap-2">
                        <Label htmlFor="ai-provider">AI voice provider</Label>
                        <Select
                            value={settings.provider}
                            onValueChange={(v) => update({ provider: v })}
                        >
                            <SelectTrigger id="ai-provider">
                                <SelectValue placeholder="Select a provider" />
                            </SelectTrigger>
                            <SelectContent>
                                {providerCodes.map((code) => (
                                    <SelectItem key={code} value={code}>
                                        {metaFor(code).label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            The AI calling agent used for this institute. The credentials and campaign
                            below are for the selected provider.
                        </p>
                    </div>

                    {settings.enabled && (
                        <div className="grid max-w-md gap-2">
                            <Label htmlFor="ai-campaign-id">Default Campaign ID</Label>
                            <Input
                                id="ai-campaign-id"
                                value={settings.defaultCampaignId}
                                placeholder={meta.campaignPlaceholder}
                                onChange={(e) => update({ defaultCampaignId: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">{meta.campaignHelp}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Campaigns (inbound / outbound) ── */}
            <Card>
                <CardHeader>
                    <CardTitle>Campaigns / Agents</CardTitle>
                    <CardDescription>
                        Register each AI campaign id and give it an agent <b>name</b> (e.g. &ldquo;Class
                        Feedback&rdquo;). Workflows reference the <b>name</b>, not the raw id — pick the
                        same name once per provider and switching provider resolves to the right id
                        automatically. Tag each Outbound (you dial) or Inbound (they dial your AI line);
                        Inbound ids classify incoming webhooks (matched to the lead by phone).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-2">
                        {(settings.campaigns ?? []).map((c, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Input
                                    value={c.name}
                                    placeholder="Agent name (e.g. Class Feedback)"
                                    onChange={(e) => updateCampaign(i, { name: e.target.value })}
                                    className="flex-1"
                                />
                                <Input
                                    value={c.campaignId}
                                    placeholder="Campaign ID"
                                    onChange={(e) => updateCampaign(i, { campaignId: e.target.value })}
                                    className="flex-1"
                                />
                                <Select
                                    value={c.provider || settings.provider}
                                    onValueChange={(v) => updateCampaign(i, { provider: v })}
                                >
                                    <SelectTrigger className="w-32">
                                        <SelectValue placeholder="Provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {providerCodes.map((code) => (
                                            <SelectItem key={code} value={code}>
                                                {metaFor(code).label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={c.direction}
                                    onValueChange={(v) =>
                                        updateCampaign(i, { direction: v as CampaignDirection })
                                    }
                                >
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="OUTBOUND">Outbound</SelectItem>
                                        <SelectItem value="INBOUND">Inbound</SelectItem>
                                    </SelectContent>
                                </Select>
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    onClick={() => removeCampaign(i)}
                                >
                                    <Trash className="size-4" />
                                </MyButton>
                            </div>
                        ))}
                        {(settings.campaigns ?? []).length === 0 && (
                            <p className="text-xs text-muted-foreground">
                                No campaigns registered yet. Add one and tag it Inbound to enable
                                inbound-call detection.
                            </p>
                        )}
                    </div>
                    <div>
                        <MyButton buttonType="secondary" scale="medium" onClick={addCampaign}>
                            <Plus className="size-4" /> Add campaign
                        </MyButton>
                    </div>
                </CardContent>
            </Card>

            {/* ── Vacademy AI agent registry (personas for our own caller) ── */}
            {providerCodes.includes('VACADEMY_AI') && (
                <AiAgentsCard
                    onBridged={mirrorBridgedCampaign}
                    onRemoved={mirrorRemovedCampaign}
                />
            )}

            {/* ── Credentials ── */}
            <Card>
                <CardHeader>
                    <CardTitle>Credentials</CardTitle>
                    <CardDescription>
                        API credentials for this institute&apos;s AI calling provider. The token and
                        webhook secret are stored encrypted and never shown again.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid max-w-md gap-2">
                        <Label htmlFor="ai-company-code">{meta.companyCodeLabel}</Label>
                        <Input
                            id="ai-company-code"
                            value={companyCode}
                            placeholder={meta.companyCodePlaceholder}
                            onChange={(e) => setCompanyCode(e.target.value)}
                        />
                    </div>
                    <div className="grid max-w-md gap-2">
                        <Label htmlFor="ai-token">{meta.tokenLabel}</Label>
                        <Input
                            id="ai-token"
                            type="password"
                            value={apiToken}
                            placeholder={
                                cfg?.hasToken
                                    ? '•••••••• (saved — leave blank to keep)'
                                    : meta.tokenPlaceholder
                            }
                            onChange={(e) => setApiToken(e.target.value)}
                        />
                    </div>
                    <div className="grid max-w-md gap-2">
                        <Label htmlFor="ai-webhook-secret">Webhook Secret</Label>
                        <Input
                            id="ai-webhook-secret"
                            type="password"
                            value={webhookSecret}
                            placeholder={
                                cfg?.hasWebhookSecret
                                    ? '•••••••• (saved — leave blank to keep)'
                                    : 'Secret for the webhook URL ?token='
                            }
                            onChange={(e) => setWebhookSecret(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Authenticates the provider&apos;s end-of-call webhook. Hand your AI provider
                            the URL {webhookPath}?instituteId=…&amp;token=&lt;this secret&gt;.
                        </p>
                    </div>
                    <div className="flex justify-end">
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={handleSaveCreds}
                            disable={savingCreds}
                        >
                            {savingCreds ? 'Saving…' : 'Save credentials'}
                        </MyButton>
                    </div>
                </CardContent>
            </Card>

            {settings.enabled && (
                <>
                    {/* ── Retry & Calling Window ── */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Retries &amp; Calling Shifts</CardTitle>
                            <CardDescription>
                                If a lead doesn&apos;t answer, the AI retries within these limits before
                                giving up. Retries are only placed inside the shifts below.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="max-retries">Max retries</Label>
                                <Input
                                    id="max-retries"
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={settings.maxRetries}
                                    onChange={(e) =>
                                        update({ maxRetries: parseInt(e.target.value, 10) || 0 })
                                    }
                                    className="w-28"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="max-per-day">Max calls per day (per lead)</Label>
                                <Input
                                    id="max-per-day"
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={settings.maxCallsPerDayPerLead}
                                    onChange={(e) =>
                                        update({
                                            maxCallsPerDayPerLead: parseInt(e.target.value, 10) || 1,
                                        })
                                    }
                                    className="w-28"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="retry-gap">Minutes between retries</Label>
                                <Input
                                    id="retry-gap"
                                    type="number"
                                    min={1}
                                    max={1440}
                                    value={settings.retryGapMinutes}
                                    onChange={(e) =>
                                        update({
                                            retryGapMinutes: parseInt(e.target.value, 10) || 1,
                                        })
                                    }
                                    className="w-28"
                                />
                                <p className="text-xs text-muted-foreground">
                                    How long the bot waits before re-dialing a no-answer lead.
                                </p>
                            </div>
                            <div className="grid gap-2 sm:col-span-2">
                                <Label>Calling shifts</Label>
                                <p className="text-xs text-muted-foreground">
                                    Time windows the bot may (re)dial in. Add multiple shifts (e.g.
                                    morning + evening). Applies to the timed retry re-dialer; immediate
                                    new-lead, manual and bulk calls fire right away.
                                </p>
                                <div className="space-y-2">
                                    {settings.callingShifts.map((shift, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <Input
                                                type="time"
                                                value={shift.start}
                                                onChange={(e) =>
                                                    updateShift(i, { start: e.target.value })
                                                }
                                                className="w-36"
                                            />
                                            <span className="text-sm text-muted-foreground">to</span>
                                            <Input
                                                type="time"
                                                value={shift.end}
                                                onChange={(e) =>
                                                    updateShift(i, { end: e.target.value })
                                                }
                                                className="w-36"
                                            />
                                            <MyButton
                                                buttonType="secondary"
                                                scale="medium"
                                                onClick={() => removeShift(i)}
                                                disable={settings.callingShifts.length <= 1}
                                            >
                                                <Trash className="size-4" />
                                            </MyButton>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <MyButton buttonType="secondary" scale="medium" onClick={addShift}>
                                        <Plus className="size-4" /> Add shift
                                    </MyButton>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="timezone">Timezone</Label>
                                <Input
                                    id="timezone"
                                    value={settings.timezone}
                                    onChange={(e) => update({ timezone: e.target.value })}
                                    className="w-48"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="connect-threshold">Min connect seconds</Label>
                                <Input
                                    id="connect-threshold"
                                    type="number"
                                    min={0}
                                    max={120}
                                    value={settings.connectThresholdSec}
                                    onChange={(e) =>
                                        update({
                                            connectThresholdSec: parseInt(e.target.value, 10) || 0,
                                        })
                                    }
                                    className="w-28"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Shorter calls count as &ldquo;not connected&rdquo; and are retried.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Outcome → Action ── */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Outcome &rarr; Action</CardTitle>
                            <CardDescription>
                                For each AI-call outcome, choose what happens. Outcomes left off both
                                lists are retried until max retries, then assigned to a human.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-1 text-xs font-medium text-muted-foreground">
                                <span>Disposition</span>
                                <span className="w-28 text-center">Assign counsellor</span>
                                <span className="w-28 text-center">Stop (no retry)</span>
                            </div>
                            {DISPOSITIONS.map((d) => (
                                <div
                                    key={d}
                                    className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6"
                                >
                                    <span className="text-sm">{d.replace(/_/g, ' ')}</span>
                                    <div className="flex w-28 justify-center">
                                        <Switch
                                            checked={settings.assignOnDispositions.includes(d)}
                                            onCheckedChange={(v) =>
                                                toggleDisposition('assignOnDispositions', d, v)
                                            }
                                        />
                                    </div>
                                    <div className="flex w-28 justify-center">
                                        <Switch
                                            checked={settings.stopOnDispositions.includes(d)}
                                            onCheckedChange={(v) =>
                                                toggleDisposition('stopOnDispositions', d, v)
                                            }
                                        />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* ── Counsellor Assignment ── */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Counsellor Assignment</CardTitle>
                            <CardDescription>
                                How a counsellor is picked when a lead qualifies (or when retries are
                                exhausted).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label>Assignment mode</Label>
                                <div className="flex flex-wrap gap-2">
                                    {ASSIGNMENT_MODES.map((m) => (
                                        <MyButton
                                            key={m.value}
                                            buttonType={
                                                settings.assignmentMode === m.value
                                                    ? 'primary'
                                                    : 'secondary'
                                            }
                                            scale="medium"
                                            onClick={() => update({ assignmentMode: m.value })}
                                        >
                                            {m.label}
                                        </MyButton>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            <div className="flex items-center gap-3">
                                <Switch
                                    id="assign-exhausted"
                                    checked={settings.assignExhaustedToHuman}
                                    onCheckedChange={(v) => update({ assignExhaustedToHuman: v })}
                                />
                                <Label htmlFor="assign-exhausted" className="cursor-pointer">
                                    Assign no-answer leads to a human after retries are exhausted
                                </Label>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* ── Save ── */}
            <div className="flex items-center justify-end">
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={handleSave}
                    disable={saving || !hasChanges || isLoading}
                >
                    {saving ? 'Saving…' : 'Save AI calling settings'}
                </MyButton>
            </div>
        </div>
    );
}
