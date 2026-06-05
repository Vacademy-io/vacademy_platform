import { useEffect, useState } from 'react';
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
    upsertTelephonyConfig,
    SELECTOR_OPTIONS,
    type TelephonyConfigInput,
    type SelectorKey,
} from '../-services/telephony-admin';

/**
 * Provider config + credential card. Designed so it scales beyond Exotel —
 * the provider dropdown will show every provider the backend has an adapter
 * for. Adding a new one is a backend-only change.
 */
const PROVIDER_OPTIONS = [{ value: 'EXOTEL', label: 'Exotel' }];

export function TelephonyConfigCard() {
    const instituteId = getCurrentInstituteId() ?? '';
    const queryClient = useQueryClient();

    const configQuery = useQuery({
        queryKey: ['telephony-config', instituteId],
        queryFn: () => fetchTelephonyConfig(instituteId),
        enabled: !!instituteId,
    });

    const [providerType, setProviderType] = useState('EXOTEL');
    const [apiAccountId, setApiAccountId] = useState('');
    const [apiUsername, setApiUsername] = useState('');
    const [apiPassword, setApiPassword] = useState('');
    const [webhookToken, setWebhookToken] = useState('');
    const [recordCalls, setRecordCalls] = useState(true);
    const [defaultSelectorKey, setDefaultSelectorKey] = useState<SelectorKey>('STICKY_PER_LEAD');
    const [enabled, setEnabled] = useState(true);

    // Hydrate form once config arrives. Secret fields are intentionally blank —
    // backend treats blank as "leave unchanged" so admins don't accidentally
    // wipe stored creds by saving the form.
    useEffect(() => {
        const c = configQuery.data;
        if (!c) return;
        setProviderType(c.providerType ?? 'EXOTEL');
        setApiAccountId(c.apiAccountId ?? '');
        setRecordCalls(c.recordCalls !== false);
        setDefaultSelectorKey((c.defaultSelectorKey as SelectorKey) ?? 'STICKY_PER_LEAD');
        setEnabled(c.enabled !== false);
    }, [configQuery.data]);

    const saveMutation = useMutation({
        mutationFn: (input: TelephonyConfigInput) => upsertTelephonyConfig(instituteId, input),
        onSuccess: () => {
            toast.success('Telephony settings saved');
            // Clear the inputs that are 'leave unchanged' so the next save
            // doesn't re-encrypt the same plaintext.
            setApiUsername('');
            setApiPassword('');
            setWebhookToken('');
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

    const onSave = () =>
        saveMutation.mutate({
            providerType,
            apiAccountId: apiAccountId || undefined,
            apiUsername: apiUsername || undefined,
            apiPassword: apiPassword || undefined,
            webhookToken: webhookToken || undefined,
            recordCalls,
            defaultSelectorKey,
            enabled,
        });

    const cfg = configQuery.data;

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
            {/* Decoy fields absorb browser autofill so the real credential
                inputs below stay empty. Chrome/Edge ignore autoComplete="off"
                on login-shaped fields, so we feed them a throwaway pair at
                the very top of the form. */}
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
                        <h2 className="text-base font-semibold text-neutral-900">
                            Calling provider
                        </h2>
                        <p className="text-sm text-neutral-500">
                            Choose your calling service and enter the keys it gave you.
                            Once saved, the call button next to each lead starts working.
                        </p>
                    </div>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable calling" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                    <Label>Calling service</Label>
                    <Select value={providerType} onValueChange={setProviderType}>
                        <SelectTrigger className="h-10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PROVIDER_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label>Account ID</Label>
                    <Input
                        value={apiAccountId}
                        onChange={(e) => setApiAccountId(e.target.value)}
                        placeholder="e.g. acmecorpsales123"
                    />
                    <p className="text-xs text-neutral-500">
                        Copy this from your provider's dashboard (Exotel shows it on the
                        API Settings page).
                    </p>
                </div>

                <CredentialField
                    label="API Key"
                    value={apiUsername}
                    set={setApiUsername}
                    isSet={!!cfg?.apiUsernameSet}
                    helper="The username-style key from your provider's API Settings page."
                />
                <CredentialField
                    label="API Token"
                    value={apiPassword}
                    set={setApiPassword}
                    isSet={!!cfg?.apiPasswordSet}
                    secret
                    helper="The password-style token from your provider's API Settings page. Stored encrypted."
                />
                <CredentialField
                    label="Callback security code (optional)"
                    value={webhookToken}
                    set={setWebhookToken}
                    isSet={!!cfg?.webhookTokenSet}
                    secret
                    helper="Adds an extra check so only call updates from your provider are accepted. Leave blank for testing — your provider's calls will still work."
                />

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
                        Decides which of your numbers (added below) is used for an
                        outgoing call. You can still override per call when dialling.
                    </p>
                </div>

                <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
                    <div>
                        <Label className="cursor-pointer">Record calls</Label>
                        <p className="text-xs text-neutral-500">
                            Needed to play back recordings from the lead's activity timeline.
                        </p>
                    </div>
                    <Switch checked={recordCalls} onCheckedChange={setRecordCalls} />
                </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
                <Button onClick={onSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving…' : 'Save changes'}
                </Button>
            </div>
        </div>
    );
}

function CredentialField({
    label,
    value,
    set,
    isSet,
    secret = false,
    helper,
}: {
    label: string;
    value: string;
    set: (v: string) => void;
    isSet: boolean;
    secret?: boolean;
    helper?: string;
}) {
    // Block browser autofill aggressively: every render uses a fresh random
    // `name` so saved Chrome credentials can't match by field name, and the
    // input stays `readOnly` until the user actually focuses it (Chrome
    // skips autofill on readOnly fields). We deliberately do NOT echo the
    // stored value back from the API — the form state starts empty.
    const [readOnly, setReadOnly] = useState(true);
    const [fieldName] = useState(
        () => `tel-${Math.random().toString(36).slice(2)}-${secret ? 'tok' : 'key'}`
    );
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
                type={secret ? 'password' : 'text'}
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
