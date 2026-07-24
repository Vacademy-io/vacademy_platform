import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useEffect, useMemo, useState } from 'react';
import { Check, Warning } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import { MultiSelect } from '@/components/design-system/multi-select';
import PackageSelector from '@/components/design-system/PackageSelector';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TIMEZONE_OPTIONS } from '@/routes/study-library/live-session/schedule/-constants/options';
import { useCampaignsList } from '@/routes/audience-manager/list/-hooks/useCampaignsList';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, OtherTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { CHANNEL_META, CHANNEL_ORDER, LANGUAGE_OPTIONS } from '../-constants';
import { useCreateEngine, useDataPointCatalog } from '../-hooks';
import type {
    AudienceSelector,
    ChannelKey,
    ChannelsConfig,
    CreateEngineRequest,
    EngineLanguage,
} from '../-types';

export const Route = createLazyFileRoute('/engagement-engines/create/')({
    component: CreateEnginePage,
});

const STEPS = ['Basics', 'Data points', 'Channels', 'Audience', 'Cadence', 'Review'] as const;

function StepRail({ current }: { current: number }) {
    return (
        <div className="flex flex-row gap-4 overflow-x-auto lg:w-52 lg:flex-col">
            {STEPS.map((label, i) => {
                const done = i < current;
                const active = i === current;
                return (
                    <div key={label} className="flex shrink-0 items-center gap-2">
                        <span
                            className={cn(
                                'flex size-6 items-center justify-center rounded-full border text-caption font-medium',
                                done && 'border-primary-500 bg-primary-500 text-white',
                                active && 'border-primary-500 text-primary-600',
                                !done && !active && 'border-neutral-300 text-neutral-400'
                            )}
                        >
                            {done ? <Check className="size-3.5" /> : i + 1}
                        </span>
                        <span
                            className={cn(
                                'text-body',
                                active ? 'font-medium text-neutral-700' : 'text-neutral-500'
                            )}
                        >
                            {label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function CreateEnginePage() {
    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();
    const instituteId = getInstituteId() || '';
    const createEngine = useCreateEngine();
    const { data: catalog } = useDataPointCatalog();
    const { data: campaignsPage } = useCampaignsList({
        institute_id: instituteId,
        page: 0,
        size: 100,
    });
    const campaigns = campaignsPage?.content ?? [];

    useEffect(() => setNavHeading('New engine'), [setNavHeading]);

    const [step, setStep] = useState(0);

    // Form state
    const [name, setName] = useState('');
    const [objective, setObjective] = useState('');
    const [brief, setBrief] = useState('');
    const [language, setLanguage] = useState<EngineLanguage>('en');
    const [dataPoints, setDataPoints] = useState<string[]>([]);
    const [consentHigh, setConsentHigh] = useState(false);
    const [channels, setChannels] = useState<ChannelsConfig>({ IN_APP: { enabled: true } });
    const [batchIds, setBatchIds] = useState<string[]>([]);
    const [audienceIds, setAudienceIds] = useState<string[]>([]);
    const [cadenceHours, setCadenceHours] = useState('72');
    const [quietStart, setQuietStart] = useState<string>('21');
    const [quietEnd, setQuietEnd] = useState<string>('8');
    const [timezone, setTimezone] = useState('Asia/Kolkata');
    const [holdoutPct, setHoldoutPct] = useState('0');
    const [firstN, setFirstN] = useState('');

    const batchesLabel = getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch);
    const audiencesLabel = getTerminologyPlural(OtherTerms.AudienceList, SystemTerms.AudienceList);
    const learnersLower = getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner).toLowerCase();

    const highSelected = useMemo(
        () =>
            (catalog ?? []).some((d) => d.sensitivity === 'HIGH' && dataPoints.includes(d.key)),
        [catalog, dataPoints]
    );

    const enabledChannelKeys = CHANNEL_ORDER.filter((c) => channels[c]?.enabled);
    const audienceCount = batchIds.length + audienceIds.length;

    // Use the campaign's `id` (the audience row PK) — that IS the audience id the engagement
    // backend's leadsByAudience(ar.audience_id = :id) resolves against. The DTO's `campaign_id`
    // and `audience_id` fields are vestigial and always null, so filtering on audience_id
    // dropped every campaign and left this picker permanently empty for all institutes.
    const campaignOptions = campaigns
        .filter((c) => c.id)
        .map((c) => ({ label: c.campaign_name, value: c.id as string }));

    const canProceed = (s: number): boolean => {
        switch (s) {
            case 0:
                return name.trim().length > 0 && brief.trim().length > 0;
            case 1:
                return !highSelected || consentHigh;
            case 2:
                return enabledChannelKeys.length > 0;
            case 3:
                return audienceCount > 0;
            case 4:
                return Number(cadenceHours) >= 1;
            default:
                return true;
        }
    };

    const toggleChannel = (c: ChannelKey, patch: Partial<ChannelsConfig[ChannelKey]>) =>
        setChannels((prev) => ({
            ...prev,
            [c]: {
                ...prev[c],
                ...patch,
                // Disabling a channel clears its dependent intents — otherwise the auto/autoReply
                // sub-toggles vanish (they only render when enabled) leaving a stale flag the user
                // can't clear, which would report a disabled channel as auto-sending.
                ...(patch?.enabled === false ? { auto: false, autoReply: false } : {}),
            },
        }));

    const buildPayload = (): CreateEngineRequest => {
        const audience: AudienceSelector[] = [
            ...batchIds.map((id) => ({ type: 'PACKAGE_SESSION' as const, id })),
            ...audienceIds.map((id) => ({ type: 'AUDIENCE' as const, id })),
        ];
        // Strip the display-only label the wizard tracks so the backend gets pure {type,id}.
        const audiencePayload = audience.map(({ type, id }) => ({ type, id }));
        const quietHours = { startHour: Number(quietStart), endHour: Number(quietEnd), timezone };
        return {
            name: name.trim(),
            objective: objective.trim() || undefined,
            brief: brief.trim(),
            language,
            dataPoints,
            channels: JSON.stringify(channels),
            audience: JSON.stringify(audiencePayload),
            quietHours: JSON.stringify(quietHours),
            cadenceHours: Number(cadenceHours),
            holdoutPct: Math.max(0, Math.min(100, Number(holdoutPct) || 0)),
            firstN: firstN.trim() ? Math.max(0, Number(firstN)) : undefined,
        };
    };

    const submit = () => {
        if (!canProceed(0)) {
            toast.error('An engine needs a name and a brief.');
            setStep(0);
            return;
        }
        createEngine.mutate(buildPayload(), {
            onSuccess: (engine) =>
                navigate({ to: '/engagement-engines/$engineId', params: { engineId: engine.id } }),
        });
    };

    return (
        <LayoutContainer>
            <Helmet>
                <title>New engagement engine</title>
            </Helmet>
            <div className="flex flex-col gap-5 p-1">
                <h1 className="text-h3 font-semibold text-neutral-700">New engine</h1>
                <div className="flex flex-col gap-6 lg:flex-row">
                    <StepRail current={step} />
                    <Card className="flex-1 p-5">
                        {step === 0 && (
                            <div className="flex flex-col gap-4">
                                <MyInput
                                    label="Engine name"
                                    required
                                    inputType="text"
                                    inputPlaceholder={`Re-engage dormant ${learnersLower}`}
                                    input={name}
                                    onChangeFunction={(e) => setName(e.target.value)}
                                />
                                <MyInput
                                    label="Objective (short)"
                                    inputType="text"
                                    inputPlaceholder={`Bring back ${learnersLower} who went quiet`}
                                    input={objective}
                                    onChangeFunction={(e) => setObjective(e.target.value)}
                                />
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="engine-brief" className="text-subtitle font-regular">
                                        The brief<span className="text-danger-600">*</span>
                                    </label>
                                    <p className="text-caption text-neutral-500">
                                        Describe the objective, tone, what to say and what to avoid, and any
                                        links. This becomes the AI&apos;s instructions — the more specific,
                                        the better.
                                    </p>
                                    <Textarea
                                        id="engine-brief"
                                        rows={7}
                                        value={brief}
                                        onChange={(e) => setBrief(e.target.value)}
                                        placeholder={`You are re-engaging ${learnersLower} who stopped attending. Be warm and brief…`}
                                    />
                                </div>
                                <div className="w-full sm:w-80">
                                    <label className="mb-1 block text-subtitle font-regular">Language</label>
                                    <SearchableSelect
                                        options={LANGUAGE_OPTIONS.map((l) => ({
                                            label: l.label,
                                            value: l.value,
                                        }))}
                                        value={language}
                                        onChange={(v) => setLanguage(v as EngineLanguage)}
                                    />
                                </div>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="flex flex-col gap-3">
                                <p className="text-body text-neutral-500">
                                    Pick the signals the AI may read about each person. More context means
                                    smarter, better-timed messages.
                                </p>
                                <div className="flex flex-col gap-2">
                                    {(catalog ?? []).map((d) => {
                                        const selected = dataPoints.includes(d.key);
                                        return (
                                            <button
                                                key={d.key}
                                                type="button"
                                                onClick={() =>
                                                    setDataPoints((prev) =>
                                                        selected
                                                            ? prev.filter((k) => k !== d.key)
                                                            : [...prev, d.key]
                                                    )
                                                }
                                                className={cn(
                                                    'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                                                    selected
                                                        ? 'border-primary-300 bg-primary-50'
                                                        : 'border-neutral-200 hover:border-primary-200'
                                                )}
                                            >
                                                <Checkbox checked={selected} className="mt-0.5" />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-subtitle font-medium text-neutral-700">
                                                            {d.label}
                                                        </span>
                                                        {d.sensitivity === 'HIGH' && (
                                                            <span className="rounded bg-warning-50 px-1.5 py-0.5 text-caption text-warning-600">
                                                                sensitive
                                                            </span>
                                                        )}
                                                    </div>
                                                    {d.description && (
                                                        <p className="mt-0.5 text-caption text-neutral-500">
                                                            {d.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                {highSelected && (
                                    <label className="mt-1 flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3">
                                        <Checkbox
                                            checked={consentHigh}
                                            onCheckedChange={(v) => setConsentHigh(v === true)}
                                            className="mt-0.5"
                                        />
                                        <span className="text-caption text-neutral-600">
                                            I confirm this institute has consent to use the sensitive data
                                            points selected above for messaging.
                                        </span>
                                    </label>
                                )}
                            </div>
                        )}

                        {step === 2 && (
                            <div className="flex flex-col gap-3">
                                <p className="text-body text-neutral-500">
                                    Which channels can this engine use? You review every message before it
                                    sends. WhatsApp needs Meta-approved templates (set up after creating).
                                </p>
                                {CHANNEL_ORDER.map((c) => {
                                    const meta = CHANNEL_META[c];
                                    const cfg = channels[c] ?? {};
                                    return (
                                        <div
                                            key={c}
                                            className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-subtitle font-medium text-neutral-700">
                                                    {meta.label}
                                                </span>
                                                <Switch
                                                    aria-label={`Enable ${meta.label}`}
                                                    checked={!!cfg.enabled}
                                                    onCheckedChange={(v) => toggleChannel(c, { enabled: v })}
                                                />
                                            </div>
                                            {cfg.enabled && meta.supportsAuto && (
                                                <label className="flex items-center justify-between pl-1">
                                                    <span className="text-caption text-neutral-500">
                                                        Auto-send proactively (after the engine graduates;
                                                        until then you review &amp; send each one)
                                                    </span>
                                                    <Switch
                                                        aria-label={`Auto-send proactively on ${meta.label}`}
                                                        checked={!!cfg.auto}
                                                        onCheckedChange={(v) => toggleChannel(c, { auto: v })}
                                                    />
                                                </label>
                                            )}
                                            {cfg.enabled && meta.supportsAutoReply && (
                                                <label className="flex items-center justify-between pl-1">
                                                    <span className="text-caption text-neutral-500">
                                                        Auto-answer replies (AI replies within 24h; money /
                                                        anger / uncertainty always escalate to you)
                                                    </span>
                                                    <Switch
                                                        aria-label={`Auto-answer replies for ${meta.label}`}
                                                        checked={!!cfg.autoReply}
                                                        onCheckedChange={(v) =>
                                                            toggleChannel(c, { autoReply: v })
                                                        }
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {step === 3 && (
                            <div className="flex flex-col gap-4">
                                <p className="text-body text-neutral-500">
                                    Who should this engine engage? Combine {batchesLabel.toLowerCase()} and{' '}
                                    {audiencesLabel.toLowerCase()} — people are de-duplicated automatically.
                                </p>
                                <div>
                                    <label className="mb-1 block text-subtitle font-regular">
                                        {batchesLabel}
                                    </label>
                                    <PackageSelector
                                        instituteId={instituteId}
                                        multiSelect
                                        initialPackageSessionIds={batchIds}
                                        onChange={({ packageSessionIds }) =>
                                            setBatchIds(packageSessionIds ?? [])
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-subtitle font-regular">
                                        {audiencesLabel}
                                    </label>
                                    <MultiSelect
                                        options={campaignOptions}
                                        selected={audienceIds}
                                        onChange={setAudienceIds}
                                        placeholder={`Select ${audiencesLabel.toLowerCase()}`}
                                    />
                                </div>
                                <p className="text-caption text-neutral-400">
                                    {audienceCount} source{audienceCount === 1 ? '' : 's'} selected.
                                </p>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="flex flex-col gap-4">
                                <MyInput
                                    label="Re-check each person every (hours)"
                                    required
                                    inputType="number"
                                    inputPlaceholder="72"
                                    input={cadenceHours}
                                    onChangeFunction={(e) => setCadenceHours(e.target.value)}
                                />
                                <p className="-mt-2 text-caption text-neutral-500">
                                    A safety floor. The AI decides the actual timing; this caps how often it
                                    revisits someone.
                                </p>
                                <div className="flex flex-col gap-2">
                                    <label className="text-subtitle font-regular">Quiet hours</label>
                                    <p className="text-caption text-neutral-500">
                                        No messages between these hours (the institute&apos;s own quiet-hours
                                        floor still applies on top of this).
                                    </p>
                                    <div className="flex flex-wrap items-end gap-3">
                                        <HourSelect label="From" value={quietStart} onChange={setQuietStart} />
                                        <HourSelect label="To" value={quietEnd} onChange={setQuietEnd} />
                                        <div className="w-56">
                                            <label className="mb-1 block text-caption text-neutral-500">
                                                Timezone
                                            </label>
                                            <SearchableSelect
                                                options={TIMEZONE_OPTIONS.map(
                                                    (t: { label: string; value: string }) => ({
                                                        label: t.label,
                                                        value: t.value,
                                                    })
                                                )}
                                                value={timezone}
                                                onChange={setTimezone}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3">
                                    <div>
                                        <p className="text-subtitle font-regular text-neutral-700">Autonomy</p>
                                        <p className="text-caption text-neutral-500">
                                            Controls that apply only to channels you set to auto-send.
                                        </p>
                                    </div>
                                    <MyInput
                                        label="Graduate after N approved sends"
                                        inputType="number"
                                        inputPlaceholder="default (5)"
                                        input={firstN}
                                        onChangeFunction={(e) => setFirstN(e.target.value)}
                                    />
                                    <p className="-mt-2 text-caption text-neutral-500">
                                        The engine stays copilot until you&apos;ve approved this many of its
                                        drafts; then auto-send channels start sending on their own. Leave
                                        blank for the default.
                                    </p>
                                    <MyInput
                                        label="Holdout %"
                                        inputType="number"
                                        inputPlaceholder="0"
                                        input={holdoutPct}
                                        onChangeFunction={(e) => {
                                            const v = e.target.value;
                                            // Keep the field inside 0..100 so what's shown always matches what's sent.
                                            if (v === '') return setHoldoutPct('');
                                            const n = Number(v);
                                            if (Number.isNaN(n)) return;
                                            setHoldoutPct(String(Math.max(0, Math.min(100, n))));
                                        }}
                                    />
                                    <p className="-mt-2 text-caption text-neutral-500">
                                        A share of the audience (0–100%) that is enrolled but never messaged,
                                        so you can measure the engine&apos;s real lift against them.
                                    </p>
                                </div>
                            </div>
                        )}

                        {step === 5 && (
                            <div className="flex flex-col gap-3">
                                <ReviewRow label="Name" value={name} />
                                <ReviewRow label="Objective" value={objective || '—'} />
                                <ReviewRow
                                    label="Language"
                                    value={LANGUAGE_OPTIONS.find((l) => l.value === language)?.label ?? language}
                                />
                                <ReviewRow
                                    label="Data points"
                                    value={dataPoints.length ? dataPoints.join(', ') : 'Always-on only'}
                                />
                                <ReviewRow
                                    label="Channels"
                                    value={enabledChannelKeys.map((c) => CHANNEL_META[c].label).join(', ')}
                                />
                                <ReviewRow label="Audience sources" value={`${audienceCount}`} />
                                <ReviewRow label="Cadence" value={`every ${cadenceHours}h`} />
                                <ReviewRow
                                    label="Quiet hours"
                                    value={`${quietStart}:00–${quietEnd}:00 ${timezone}`}
                                />
                                <ReviewRow
                                    label="Auto-send channels"
                                    value={
                                        CHANNEL_ORDER.filter((c) => channels[c]?.enabled && channels[c]?.auto)
                                            .map((c) => CHANNEL_META[c].label)
                                            .join(', ') || 'None (copilot only)'
                                    }
                                />
                                <ReviewRow
                                    label="Holdout"
                                    value={`${Math.max(0, Math.min(100, Number(holdoutPct) || 0))}%`}
                                />
                                <div className="mt-2 flex items-start gap-2 rounded-lg border border-info-200 bg-info-50 p-3">
                                    <Warning className="mt-0.5 size-4 shrink-0 text-info-600" />
                                    <p className="text-caption text-neutral-600">
                                        The engine starts as a <b>Draft</b>. After creating it, enroll the
                                        audience and (for WhatsApp) set up templates, then activate it.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4">
                            <MyButton
                                buttonType="secondary"
                                scale="medium"
                                disable={step === 0}
                                onClick={() => setStep((s) => Math.max(0, s - 1))}
                            >
                                Back
                            </MyButton>
                            {step < STEPS.length - 1 ? (
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    disable={!canProceed(step)}
                                    onClick={() => setStep((s) => s + 1)}
                                >
                                    Continue
                                </MyButton>
                            ) : (
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    disable={createEngine.isPending}
                                    onClick={submit}
                                >
                                    {createEngine.isPending ? 'Creating…' : 'Create engine'}
                                </MyButton>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </LayoutContainer>
    );
}

function HourSelect({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="w-28">
            <label className="mb-1 block text-caption text-neutral-500">{label}</label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                        <SelectItem key={h} value={String(h)}>
                            {String(h).padStart(2, '0')}:00
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-2">
            <span className="text-body text-neutral-500">{label}</span>
            <span className="max-w-sm text-right text-body font-medium text-neutral-700">{value}</span>
        </div>
    );
}
