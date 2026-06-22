import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Phone, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    fetchTelephonyConfig,
    fetchTelephonyProviders,
    upsertTelephonyConfig,
    SELECTOR_OPTIONS,
    type ProviderDescriptor,
    type ProviderCredentialField,
    type TelephonyConfigInput,
    type TelephonyConfigView,
    type SelectorKey,
} from '../-services/telephony-admin';

/**
 * Provider config + credential card — fully backend-driven. The provider
 * dropdown and the credential form both come from GET /telephony/providers, so
 * adding a provider (e.g. Airtel) is a backend-only change. Exotel keeps its
 * legacy field shape; every other provider submits generic secrets/config maps.
 */
export function TelephonyConfigCard() {
    const instituteId = getCurrentInstituteId() ?? '';
    const queryClient = useQueryClient();

    const providersQuery = useQuery({
        queryKey: ['telephony-providers'],
        queryFn: fetchTelephonyProviders,
    });
    const configQuery = useQuery({
        queryKey: ['telephony-config', instituteId],
        queryFn: () => fetchTelephonyConfig(instituteId),
        enabled: !!instituteId,
    });

    const providers = useMemo(() => providersQuery.data ?? [], [providersQuery.data]);

    const [providerType, setProviderType] = useState('');
    // Credential/config field values keyed by the schema field key.
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [recordCalls, setRecordCalls] = useState(true);
    const [enabled, setEnabled] = useState(true);
    const [defaultSelectorKey, setDefaultSelectorKey] = useState<SelectorKey>('STICKY_PER_LEAD');
    const [voicemailNumber, setVoicemailNumber] = useState('');

    const cfg = configQuery.data;
    const provider = providers.find((p) => p.providerType === providerType);
    const has = (cap: string) => !!provider?.capabilities?.includes(cap);

    // Pick the active provider once both queries settle: the saved one, else the first.
    useEffect(() => {
        if (providerType) return;
        if (cfg?.providerType) setProviderType(cfg.providerType);
        else if (providers[0]) setProviderType(providers[0].providerType);
    }, [cfg, providers, providerType]);

    // Hydrate non-secret fields + flags from the saved config. Secrets stay blank
    // (backend treats blank as "leave unchanged" — never echoed back).
    useEffect(() => {
        if (!cfg) return;
        setRecordCalls(cfg.recordCalls !== false);
        setEnabled(cfg.enabled !== false);
        setDefaultSelectorKey((cfg.defaultSelectorKey as SelectorKey) ?? 'STICKY_PER_LEAD');
        setVoicemailNumber(cfg.inboundVoicemailNumber ?? '');
        setFieldValues(hydrateNonSecret(cfg));
    }, [cfg]);

    const saveMutation = useMutation({
        mutationFn: (input: TelephonyConfigInput) => upsertTelephonyConfig(instituteId, input),
        onSuccess: () => {
            toast.success('Calling settings saved');
            // Clear secret inputs so a re-save doesn't re-encrypt the same plaintext.
            setFieldValues((prev) => {
                const next = { ...prev };
                provider?.credentialSchema.forEach((f) => {
                    if (f.secret) delete next[f.key];
                });
                return next;
            });
            queryClient.invalidateQueries({ queryKey: ['telephony-config', instituteId] });
        },
        onError: (err) => {
            const msg =
                typeof err === 'object' && err && 'message' in err
                    ? String((err as { message: unknown }).message)
                    : 'Failed to save settings';
            toast.error(msg);
        },
    });

    const onSave = () => {
        if (!provider) return;
        const trimmed = (k: string) => (fieldValues[k] ?? '').trim();

        if (provider.usesGenericCredentialStore) {
            const secrets: Record<string, string> = {};
            const config: Record<string, string> = {};
            provider.credentialSchema.forEach((f) => {
                const v = trimmed(f.key);
                if (f.secret) {
                    if (v) secrets[f.key] = v; // blank = leave unchanged
                } else {
                    config[f.key] = v;
                }
            });
            saveMutation.mutate({
                providerType: provider.providerType,
                authType: provider.authType,
                secrets,
                config,
                recordCalls,
                enabled,
            });
        } else {
            // Exotel: schema keys map 1:1 onto the legacy DTO fields.
            saveMutation.mutate({
                providerType: provider.providerType,
                apiAccountId: trimmed('apiAccountId') || undefined,
                apiUsername: trimmed('apiUsername') || undefined,
                apiPassword: trimmed('apiPassword') || undefined,
                webhookToken: trimmed('webhookToken') || undefined,
                flowSid: trimmed('flowSid'),
                recordCalls,
                enabled,
                defaultSelectorKey,
                inboundVoicemailNumber: voicemailNumber.trim(),
            });
        }
    };

    const isFieldSet = (field: ProviderCredentialField): boolean => {
        if (!cfg || !field.secret) return false;
        if (provider?.usesGenericCredentialStore) return !!cfg.providerSecretsSet;
        if (field.key === 'apiUsername') return !!cfg.apiUsernameSet;
        if (field.key === 'apiPassword') return !!cfg.apiPasswordSet;
        if (field.key === 'webhookToken') return !!cfg.webhookTokenSet;
        return false;
    };

    const setField = (key: string, value: string) =>
        setFieldValues((prev) => ({ ...prev, [key]: value }));

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
            {/* Decoy fields absorb browser autofill so the real credential inputs stay empty. */}
            <div aria-hidden className="pointer-events-none size-0 overflow-hidden opacity-0">
                <input type="text" tabIndex={-1} autoComplete="username" name="fake-username" />
                <input
                    type="password"
                    tabIndex={-1}
                    autoComplete="current-password"
                    name="fake-password"
                />
            </div>

            <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <Phone className="size-5 text-primary-600" />
                    <div>
                        <h2 className="text-base font-semibold text-neutral-900">Calling provider</h2>
                        <p className="text-sm text-neutral-500">
                            Choose your calling service and enter the keys it gave you. Once saved,
                            the call button next to each lead starts working.
                        </p>
                    </div>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable calling" />
            </div>

            {providersQuery.isLoading ? (
                <p className="text-sm text-neutral-500">Loading providers…</p>
            ) : providers.length === 0 ? (
                <p className="text-sm text-warning-700">
                    No calling providers are available on this server.
                </p>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Calling service</Label>
                        <Select value={providerType} onValueChange={setProviderType}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Select a provider" />
                            </SelectTrigger>
                            <SelectContent>
                                {providers.map((p: ProviderDescriptor) => (
                                    <SelectItem key={p.providerType} value={p.providerType}>
                                        {p.displayName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Schema-driven credential + config fields for the selected provider. */}
                    {(provider?.credentialSchema ?? []).map((field) =>
                        field.secret ? (
                            <SecretField
                                key={field.key}
                                label={field.label}
                                value={fieldValues[field.key] ?? ''}
                                set={(v) => setField(field.key, v)}
                                isSet={isFieldSet(field)}
                                helper={field.helpText ?? undefined}
                            />
                        ) : (
                            <div key={field.key} className="space-y-1.5">
                                <Label>
                                    {field.label}
                                    {field.required ? '' : ' (optional)'}
                                </Label>
                                <Input
                                    value={fieldValues[field.key] ?? ''}
                                    onChange={(e) => setField(field.key, e.target.value)}
                                    placeholder={field.required ? 'Required' : 'Optional'}
                                />
                                {field.helpText && (
                                    <p className="text-xs text-neutral-500">{field.helpText}</p>
                                )}
                            </div>
                        )
                    )}

                    {/* Exotel-only: caller-ID number strategy (pooled numbers). */}
                    {has('NUMBER_POOL') && (
                        <div className="space-y-1.5">
                            <Label>Which number should leads see?</Label>
                            <Select
                                value={defaultSelectorKey}
                                onValueChange={(v) => setDefaultSelectorKey(v as SelectorKey)}
                            >
                                <SelectTrigger className="h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SELECTOR_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <div className="flex flex-col">
                                                <span>{opt.label}</span>
                                                <span className="text-xs text-neutral-500">
                                                    {opt.helper}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-neutral-500">
                                Decides which of your numbers is used for an outgoing call. You can
                                still override per call when dialling.
                            </p>
                        </div>
                    )}

                    {/* Exotel-only: inbound voicemail fallback (synchronous applet routing). */}
                    {has('SYNC_INBOUND_APPLET') && (
                        <div className="space-y-1.5">
                            <Label>Voicemail / fallback number</Label>
                            <Input
                                value={voicemailNumber}
                                onChange={(e) => setVoicemailNumber(e.target.value)}
                                placeholder="+91xxxxxxxxxx"
                            />
                            <p className="text-xs text-neutral-500">
                                When a lead calls back and no counsellor is available, the call is
                                forwarded here instead of being dropped.
                            </p>
                        </div>
                    )}

                    {has('RECORDING') && (
                        <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
                            <div>
                                <Label className="cursor-pointer">Record calls</Label>
                                <p className="text-xs text-neutral-500">
                                    Needed to play back recordings from the lead's activity timeline.
                                </p>
                            </div>
                            <Switch checked={recordCalls} onCheckedChange={setRecordCalls} />
                        </div>
                    )}
                </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
                <Button onClick={onSave} disabled={saveMutation.isPending || !provider}>
                    {saveMutation.isPending ? 'Saving…' : 'Save changes'}
                </Button>
            </div>
        </div>
    );
}

/** Pre-fill non-secret (config) fields from the saved config; secrets stay blank. */
function hydrateNonSecret(cfg: TelephonyConfigView): Record<string, string> {
    const out: Record<string, string> = {};
    if (cfg.apiAccountId) out['apiAccountId'] = cfg.apiAccountId; // Exotel legacy
    if (cfg.flowSid) out['flowSid'] = cfg.flowSid; // Exotel legacy
    if (cfg.config) Object.entries(cfg.config).forEach(([k, v]) => (out[k] = v)); // generic
    return out;
}

function SecretField({
    label,
    value,
    set,
    isSet,
    helper,
}: {
    label: string;
    value: string;
    set: (v: string) => void;
    isSet: boolean;
    helper?: string;
}) {
    // Block browser autofill: fresh random name per render + readOnly-until-focus.
    const [readOnly, setReadOnly] = useState(true);
    const [fieldName] = useState(() => `tel-${Math.random().toString(36).slice(2)}-tok`);
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label>{label}</Label>
                {isSet ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success-700">
                        <CheckCircle className="size-3" /> Saved
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-warning-700">
                        <WarningCircle className="size-3" /> Not set
                    </span>
                )}
            </div>
            <Input
                type="password"
                name={fieldName}
                id={fieldName}
                value={value}
                onChange={(e) => set(e.target.value)}
                onFocus={() => setReadOnly(false)}
                onBlur={() => setReadOnly(true)}
                readOnly={readOnly}
                placeholder={isSet ? 'Leave blank to keep the saved one' : 'Paste your key here'}
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                spellCheck={false}
            />
            {helper && <p className="text-xs text-neutral-500">{helper}</p>}
        </div>
    );
}
