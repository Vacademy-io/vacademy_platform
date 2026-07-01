import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, PhoneCall, ShieldCheck, Receipt, Info } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    type VoiceConfigView,
    type VoiceCallingSettings,
    fetchVoiceConfig,
    saveVoiceConfig,
} from '../-services/voice-config';

function toDraft(view?: VoiceConfigView): VoiceCallingSettings {
    const c = view?.config ?? {};
    return {
        enabled: c.enabled ?? false,
        defaultCallerId: c.defaultCallerId ?? '',
        appId: c.appId ?? '',
        plivoSubaccountId: c.plivoSubaccountId ?? '',
        numbers: c.numbers ?? [],
        recordCalls: c.recordCalls ?? true,
        timezone: c.timezone ?? 'Asia/Kolkata',
        billing: {
            purchasedChannels: c.billing?.purchasedChannels ?? null,
            planName: c.billing?.planName ?? '',
            notes: c.billing?.notes ?? '',
            perMinuteCreditOverride: c.billing?.perMinuteCreditOverride ?? null,
            perChannelDayCreditOverride: c.billing?.perChannelDayCreditOverride ?? null,
        },
        compliance: {
            dltApproved: c.compliance?.dltApproved ?? false,
            dndScrubEnabled: c.compliance?.dndScrubEnabled ?? true,
            nightCutoffEnabled: c.compliance?.nightCutoffEnabled ?? true,
            cutoffHour: c.compliance?.cutoffHour ?? 21,
            startHour: c.compliance?.startHour ?? 9,
            disclosureEnabled: c.compliance?.disclosureEnabled ?? true,
        },
    };
}

/**
 * Settings-driven Vacademy Voice (Plivo) product config. Shown only when the active
 * provider declares MANAGED_VOICE. The Plivo CREDENTIALS live in the generic provider
 * card; this card holds the product config we (or the institute) fill in: enable flag,
 * caller-ID, recording, timezone, compliance status, plan/channels, and the inbound
 * answer-URL to paste into Plivo. Automation comes later — for now it's all editable here.
 */
export function VacademyVoiceConfigCard() {
    const instituteId = getCurrentInstituteId() ?? '';
    const queryClient = useQueryClient();

    const configQuery = useQuery({
        queryKey: ['voice-config', instituteId],
        queryFn: () => fetchVoiceConfig(instituteId),
        enabled: !!instituteId,
    });

    const [draft, setDraft] = useState<VoiceCallingSettings>(() => toDraft());

    useEffect(() => {
        if (configQuery.data) setDraft(toDraft(configQuery.data));
    }, [configQuery.data]);

    const saveMutation = useMutation({
        mutationFn: (cfg: VoiceCallingSettings) => saveVoiceConfig(instituteId, cfg),
        onSuccess: () => {
            toast.success('Vacademy Voice settings saved');
            queryClient.invalidateQueries({ queryKey: ['voice-config', instituteId] });
        },
        onError: (err) =>
            toast.error(err instanceof Error ? err.message : 'Could not save settings'),
    });

    const patch = (p: Partial<VoiceCallingSettings>) => setDraft((d) => ({ ...d, ...p }));
    const patchBilling = (p: Partial<NonNullable<VoiceCallingSettings['billing']>>) =>
        setDraft((d) => ({ ...d, billing: { ...d.billing, ...p } }));
    const patchCompliance = (p: Partial<NonNullable<VoiceCallingSettings['compliance']>>) =>
        setDraft((d) => ({ ...d, compliance: { ...d.compliance, ...p } }));

    const base = (configQuery.data?.webhookCallbackBase ?? '').trim().replace(/\/$/, '');
    const answerUrl = base ? `${base}/admin-core-service/v1/telephony/plivo/answer/inbound` : '';

    if (configQuery.isLoading) {
        return (
            <Card>
                <CardContent className="py-6">
                    <Skeleton className="h-40 w-full rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex flex-col gap-1">
                    <CardTitle className="flex items-center gap-2">
                        <PhoneCall className="text-primary-500" />
                        Vacademy Voice setup
                    </CardTitle>
                    <CardDescription>
                        Configure your managed calling product. Enter the details we provided you (or
                        that your setup needs) — we’ll automate more of this over time.
                    </CardDescription>
                </div>
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={() => saveMutation.mutate(draft)}
                    disable={saveMutation.isPending}
                >
                    {saveMutation.isPending ? 'Saving…' : 'Save changes'}
                </MyButton>
            </CardHeader>

            <CardContent className="flex flex-col gap-6">
                {/* General */}
                <section className="flex flex-col gap-4">
                    <ToggleRow
                        label="Vacademy Voice enabled"
                        description="Turn the product on for this institute once setup is complete."
                        checked={draft.enabled ?? false}
                        onChange={(v) => patch({ enabled: v })}
                    />
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <MyInput
                            label="Default caller ID"
                            inputType="text"
                            inputPlaceholder="+9180XXXXXXXX"
                            input={draft.defaultCallerId ?? ''}
                            onChangeFunction={(e) => patch({ defaultCallerId: e.target.value })}
                        />
                        <MyInput
                            label="Timezone"
                            inputType="text"
                            inputPlaceholder="Asia/Kolkata"
                            input={draft.timezone ?? ''}
                            onChangeFunction={(e) => patch({ timezone: e.target.value })}
                        />
                    </div>
                    <ToggleRow
                        label="Record calls"
                        description="Store call recordings securely (private, encrypted)."
                        checked={draft.recordCalls ?? true}
                        onChange={(v) => patch({ recordCalls: v })}
                    />
                </section>

                {/* Compliance */}
                <section className="flex flex-col gap-4 border-t border-neutral-100 pt-5">
                    <SectionHeading icon={<ShieldCheck className="text-primary-500" />} title="Compliance" />
                    <ToggleRow
                        label="DLT registration approved"
                        description="Required before running promotional campaigns in India."
                        checked={draft.compliance?.dltApproved ?? false}
                        onChange={(v) => patchCompliance({ dltApproved: v })}
                    />
                    <ToggleRow
                        label="Scrub DND / NCPR numbers"
                        description="Suppress numbers on the Do-Not-Disturb registry before dialling."
                        checked={draft.compliance?.dndScrubEnabled ?? true}
                        onChange={(v) => patchCompliance({ dndScrubEnabled: v })}
                    />
                    <ToggleRow
                        label="Nightly outbound cutoff"
                        description="No outbound calls outside the allowed hours below."
                        checked={draft.compliance?.nightCutoffEnabled ?? true}
                        onChange={(v) => patchCompliance({ nightCutoffEnabled: v })}
                    />
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <MyInput
                            label="Earliest hour (0–23)"
                            inputType="number"
                            input={String(draft.compliance?.startHour ?? 9)}
                            onChangeFunction={(e) =>
                                patchCompliance({ startHour: Number(e.target.value) })
                            }
                        />
                        <MyInput
                            label="Cutoff hour (0–23)"
                            inputType="number"
                            input={String(draft.compliance?.cutoffHour ?? 21)}
                            onChangeFunction={(e) =>
                                patchCompliance({ cutoffHour: Number(e.target.value) })
                            }
                        />
                    </div>
                </section>

                {/* Plan & channels */}
                <section className="flex flex-col gap-4 border-t border-neutral-100 pt-5">
                    <SectionHeading icon={<Receipt className="text-primary-500" />} title="Plan & channels" />
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <MyInput
                            label="Concurrent channels"
                            inputType="number"
                            inputPlaceholder="e.g. 5"
                            input={
                                draft.billing?.purchasedChannels != null
                                    ? String(draft.billing.purchasedChannels)
                                    : ''
                            }
                            onChangeFunction={(e) =>
                                patchBilling({
                                    purchasedChannels: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                })
                            }
                        />
                        <MyInput
                            label="Plan name"
                            inputType="text"
                            inputPlaceholder="e.g. Voice Starter"
                            input={draft.billing?.planName ?? ''}
                            onChangeFunction={(e) => patchBilling({ planName: e.target.value })}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label className="text-subtitle font-regular">Notes</Label>
                        <Textarea
                            value={draft.billing?.notes ?? ''}
                            onChange={(e) => patchBilling({ notes: e.target.value })}
                            placeholder="What was provisioned for this institute…"
                            className="min-h-16"
                        />
                    </div>
                </section>

                {/* Inbound setup guide */}
                <section className="flex flex-col gap-3 border-t border-neutral-100 pt-5">
                    <SectionHeading icon={<Info className="text-primary-500" />} title="Inbound setup" />
                    <p className="text-body text-neutral-600">
                        In the Plivo dashboard, point your number’s <strong>Application</strong>{' '}
                        <em>Answer URL</em> at the URL below (POST). Inbound calls will then play this
                        institute’s IVR menu.
                    </p>
                    {answerUrl ? (
                        <CopyableUrl label="Answer URL" url={answerUrl} />
                    ) : (
                        <div className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-caption text-warning-800">
                            The server hasn’t advertised its public webhook URL
                            (telephony.webhook.callback-base). Ask your server admin to set it.
                        </div>
                    )}
                </section>
            </CardContent>
        </Card>
    );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-subtitle font-semibold text-neutral-700">{title}</h3>
        </div>
    );
}

function ToggleRow({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
                <Label className="text-subtitle font-regular text-neutral-700">{label}</Label>
                {description && <span className="text-caption text-neutral-500">{description}</span>}
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}

function CopyableUrl({ label, url }: { label: string; url: string }) {
    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            toast.success(`${label} copied`);
        } catch {
            toast.error('Could not copy — copy by hand');
        }
    };
    return (
        <div className="flex items-stretch gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
            <code className="min-w-0 flex-1 break-all px-2 py-1 text-caption text-neutral-700">
                {url}
            </code>
            <MyButton buttonType="secondary" layoutVariant="icon" scale="small" onClick={onCopy}>
                <Copy />
            </MyButton>
        </div>
    );
}
