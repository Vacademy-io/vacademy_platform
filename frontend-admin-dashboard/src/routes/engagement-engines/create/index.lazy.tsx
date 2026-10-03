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
import { buildTimezoneOptions } from '@/routes/study-library/live-session/schedule/-constants/options';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useCampaignsList } from '@/routes/audience-manager/list/-hooks/useCampaignsList';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, OtherTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { buildChannelMeta, CHANNEL_ORDER, buildLanguageOptions } from '../-constants';
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

const STEP_KEYS = ['basics', 'dataPoints', 'channels', 'audience', 'cadence', 'review'] as const;

function StepRail({ current, t }: { current: number; t: TFunction }) {
    return (
        <div className="flex flex-row gap-4 overflow-x-auto lg:w-52 lg:flex-col">
            {STEP_KEYS.map((key, i) => {
                const label = t(`steps.${key}`);
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
    // Timezone labels are translated, so the list is built from the shared
    // options namespace rather than being a module-level constant.
    const { t: tOptions } = useTranslation('studyLibraryOptions');
    const { t: tConstants } = useTranslation('engagementEnginesConstants');
    const { t } = useTranslation('engagementEnginesCreateIndex');
    const TIMEZONE_OPTIONS = buildTimezoneOptions(tOptions);
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

    useEffect(() => setNavHeading(t('heading')), [setNavHeading, t]);

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

    // Always-on data points are read whatever the selection, so their sensitivity counts too.
    const highSelected = useMemo(
        () =>
            (catalog ?? []).some(
                (d) => d.sensitivity === 'HIGH' && (d.alwaysOn || dataPoints.includes(d.key))
            ),
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
            toast.error(t('errors.nameAndBrief'));
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
                <title>{t('pageTitle')}</title>
            </Helmet>
            <div className="flex flex-col gap-5 p-1">
                <h1 className="text-h3 font-semibold text-neutral-700">{t('heading')}</h1>
                <div className="flex flex-col gap-6 lg:flex-row">
                    <StepRail current={step} t={t} />
                    <Card className="flex-1 p-5">
                        {step === 0 && (
                            <div className="flex flex-col gap-4">
                                <MyInput
                                    label={t('basics.name')}
                                    required
                                    inputType="text"
                                    inputPlaceholder={t('basics.namePlaceholder', { learners: learnersLower })}
                                    input={name}
                                    onChangeFunction={(e) => setName(e.target.value)}
                                />
                                <MyInput
                                    label={t('basics.objective')}
                                    inputType="text"
                                    inputPlaceholder={t('basics.objectivePlaceholder', { learners: learnersLower })}
                                    input={objective}
                                    onChangeFunction={(e) => setObjective(e.target.value)}
                                />
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="engine-brief" className="text-subtitle font-regular">
                                        {t('basics.brief')}
                                        <span className="text-danger-600">*</span>
                                    </label>
                                    <p className="text-caption text-neutral-500">{t('basics.briefHint')}</p>
                                    <Textarea
                                        id="engine-brief"
                                        rows={7}
                                        value={brief}
                                        onChange={(e) => setBrief(e.target.value)}
                                        placeholder={t('basics.briefPlaceholder', { learners: learnersLower })}
                                    />
                                </div>
                                <div className="w-full sm:w-80">
                                    <label className="mb-1 block text-subtitle font-regular">
                                        {t('basics.language')}
                                    </label>
                                    <SearchableSelect
                                        options={buildLanguageOptions(tConstants).map((l) => ({
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
                                <p className="text-body text-neutral-500">{t('dataPoints.intro')}</p>
                                <div className="flex flex-col gap-2">
                                    {(catalog ?? []).map((d) => {
                                        const alwaysOn = d.alwaysOn === true;
                                        const selected = alwaysOn || dataPoints.includes(d.key);
                                        return (
                                            <button
                                                key={d.key}
                                                type="button"
                                                disabled={alwaysOn}
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
                                                        : 'border-neutral-200 hover:border-primary-200',
                                                    alwaysOn && 'cursor-default'
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
                                                                {t('dataPoints.sensitive')}
                                                            </span>
                                                        )}
                                                        {alwaysOn && (
                                                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-caption text-neutral-500">
                                                                {t('dataPoints.alwaysOn')}
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
                                            {t('dataPoints.consent')}
                                        </span>
                                    </label>
                                )}
                            </div>
                        )}

                        {step === 2 && (
                            <div className="flex flex-col gap-3">
                                <p className="text-body text-neutral-500">{t('channels.intro')}</p>
                                {CHANNEL_ORDER.map((c) => {
                                    const meta = buildChannelMeta(tConstants)[c];
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
                                                    aria-label={t('channels.enableAria', { channel: meta.label })}
                                                    checked={!!cfg.enabled}
                                                    onCheckedChange={(v) => toggleChannel(c, { enabled: v })}
                                                />
                                            </div>
                                            {cfg.enabled && meta.supportsAuto && (
                                                <label className="flex items-center justify-between pl-1">
                                                    <span className="text-caption text-neutral-500">
                                                        {t('channels.auto')}
                                                    </span>
                                                    <Switch
                                                        aria-label={t('channels.autoAria', { channel: meta.label })}
                                                        checked={!!cfg.auto}
                                                        onCheckedChange={(v) => toggleChannel(c, { auto: v })}
                                                    />
                                                </label>
                                            )}
                                            {cfg.enabled && meta.supportsAutoReply && (
                                                <label className="flex items-center justify-between pl-1">
                                                    <span className="text-caption text-neutral-500">
                                                        {t('channels.autoReply')}
                                                    </span>
                                                    <Switch
                                                        aria-label={t('channels.autoReplyAria', { channel: meta.label })}
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
                                    {t('audience.intro', {
                                        batches: batchesLabel.toLowerCase(),
                                        audiences: audiencesLabel.toLowerCase(),
                                    })}
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
                                        placeholder={t('audience.select', { audiences: audiencesLabel.toLowerCase() })}
                                    />
                                </div>
                                <p className="text-caption text-neutral-400">
                                    {t('audience.count', { count: audienceCount })}
                                </p>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="flex flex-col gap-4">
                                <MyInput
                                    label={t('cadence.recheck')}
                                    required
                                    inputType="number"
                                    inputPlaceholder="72"
                                    input={cadenceHours}
                                    onChangeFunction={(e) => setCadenceHours(e.target.value)}
                                />
                                <p className="-mt-2 text-caption text-neutral-500">{t('cadence.recheckHint')}</p>
                                <div className="flex flex-col gap-2">
                                    <label className="text-subtitle font-regular">{t('cadence.quietHours')}</label>
                                    <p className="text-caption text-neutral-500">{t('cadence.quietHint')}</p>
                                    <div className="flex flex-wrap items-end gap-3">
                                        <HourSelect label={t('cadence.from')} value={quietStart} onChange={setQuietStart} />
                                        <HourSelect label={t('cadence.to')} value={quietEnd} onChange={setQuietEnd} />
                                        <div className="w-56">
                                            <label className="mb-1 block text-caption text-neutral-500">
                                                {t('cadence.timezone')}
                                            </label>
                                            <SearchableSelect
                                                options={TIMEZONE_OPTIONS.map(
                                                    (o: { label: string; value: string }) => ({
                                                        label: o.label,
                                                        value: o.value,
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
                                        <p className="text-subtitle font-regular text-neutral-700">
                                            {t('autonomy.title')}
                                        </p>
                                        <p className="text-caption text-neutral-500">{t('autonomy.hint')}</p>
                                    </div>
                                    <MyInput
                                        label={t('autonomy.firstN')}
                                        inputType="number"
                                        inputPlaceholder={t('autonomy.firstNPlaceholder')}
                                        input={firstN}
                                        onChangeFunction={(e) => setFirstN(e.target.value)}
                                    />
                                    <p className="-mt-2 text-caption text-neutral-500">{t('autonomy.firstNHint')}</p>
                                    <MyInput
                                        label={t('autonomy.holdout')}
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
                                    <p className="-mt-2 text-caption text-neutral-500">{t('autonomy.holdoutHint')}</p>
                                </div>
                            </div>
                        )}

                        {step === 5 && (
                            <div className="flex flex-col gap-3">
                                <ReviewRow label={t('review.name')} value={name} />
                                <ReviewRow label={t('review.objective')} value={objective || '—'} />
                                <ReviewRow
                                    label={t('review.language')}
                                    value={buildLanguageOptions(tConstants).find((l) => l.value === language)?.label ?? language}
                                />
                                <ReviewRow
                                    label={t('review.dataPoints')}
                                    value={dataPoints.length ? dataPoints.join(', ') : t('review.dataPointsNone')}
                                />
                                <ReviewRow
                                    label={t('review.channels')}
                                    value={enabledChannelKeys.map((c) => buildChannelMeta(tConstants)[c].label).join(', ')}
                                />
                                <ReviewRow label={t('review.audienceSources')} value={`${audienceCount}`} />
                                <ReviewRow
                                    label={t('review.cadence')}
                                    value={t('review.cadenceValue', { hours: cadenceHours })}
                                />
                                <ReviewRow
                                    label={t('review.quietHours')}
                                    value={`${quietStart}:00–${quietEnd}:00 ${timezone}`}
                                />
                                <ReviewRow
                                    label={t('review.autoSendChannels')}
                                    value={
                                        CHANNEL_ORDER.filter((c) => channels[c]?.enabled && channels[c]?.auto)
                                            .map((c) => buildChannelMeta(tConstants)[c].label)
                                            .join(', ') || t('review.autoSendNone')
                                    }
                                />
                                <ReviewRow
                                    label={t('review.holdout')}
                                    value={`${Math.max(0, Math.min(100, Number(holdoutPct) || 0))}%`}
                                />
                                <div className="mt-2 flex items-start gap-2 rounded-lg border border-info-200 bg-info-50 p-3">
                                    <Warning className="mt-0.5 size-4 shrink-0 text-info-600" />
                                    <p className="text-caption text-neutral-600">{t('review.draftNote')}</p>
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
                                {t('actions.back')}
                            </MyButton>
                            {step < STEP_KEYS.length - 1 ? (
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    disable={!canProceed(step)}
                                    onClick={() => setStep((s) => s + 1)}
                                >
                                    {t('actions.continue')}
                                </MyButton>
                            ) : (
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    disable={createEngine.isPending}
                                    onClick={submit}
                                >
                                    {createEngine.isPending ? t('actions.creating') : t('actions.create')}
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
