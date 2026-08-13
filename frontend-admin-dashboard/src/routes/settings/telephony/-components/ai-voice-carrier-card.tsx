import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Warning, Robot, LinkSimple, Users } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { cn } from '@/lib/utils';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    type AiCarrierMode,
    type AiVoiceCarrierView,
    fetchAiVoiceCarrier,
    saveAiVoiceCarrier,
    unlinkAiVoiceCarrier,
} from '../-services/ai-voice-carrier';

interface DedicatedDraft {
    authId: string;
    authToken: string;
    callerId: string;
    appId: string;
    webhookToken: string;
    recordCalls: boolean;
    enabled: boolean;
}

const emptyDraft = (): DedicatedDraft => ({
    authId: '',
    authToken: '',
    callerId: '',
    appId: '',
    webhookToken: '',
    recordCalls: true,
    enabled: true,
});

/**
 * The actionable half of a failed save lives in the server's body, not in the axios
 * Error — whose `.message` is only "Request failed with status code 510". Every
 * validation message this form can trigger ("Plivo Auth ID is required", "A caller-ID
 * number is required…") comes from the backend, so showing `err.message` would render
 * the whole form unfixable-by-reading. Same shape as `use-place-ai-call`.
 */
function serverError(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
        const e = err as {
            response?: { data?: { ex?: string; message?: string } };
            message?: string;
        };
        if (typeof e.response?.data?.ex === 'string') return e.response.data.ex;
        if (typeof e.response?.data?.message === 'string') return e.response.data.message;
    }
    return fallback;
}

const toDraft = (view?: AiVoiceCarrierView): DedicatedDraft => ({
    authId: view?.authId ?? '',
    // Secrets are never returned by the API, so the field always starts empty and an
    // empty value means "keep what's stored" — see the placeholder copy below.
    authToken: '',
    callerId: view?.callerId ?? '',
    appId: view?.appId ?? '',
    webhookToken: '',
    recordCalls: view?.recordCalls ?? true,
    enabled: view?.dedicatedEnabled ?? true,
});

/**
 * Picks the line this institute's AI calls go out on.
 *
 * AI calling streams live audio over Plivo, so it needs a Vacademy Voice line.
 * Institutes already on Vacademy Voice just share the one their team uses; institutes
 * on Airtel or Exotel have no such line — for them the first option is refused with the
 * reason, and they link a separate Plivo subaccount that only the AI dials on. Human
 * calling is never touched either way, which the card says out loud because that is the
 * question an admin actually has before clicking anything here.
 */
export function AiVoiceCarrierCard() {
    const instituteId = getCurrentInstituteId() ?? '';
    const queryClient = useQueryClient();

    const carrierQuery = useQuery({
        queryKey: ['ai-voice-carrier', instituteId],
        queryFn: () => fetchAiVoiceCarrier(instituteId),
        enabled: !!instituteId,
    });
    const view = carrierQuery.data;

    const [mode, setMode] = useState<AiCarrierMode>('PRIMARY');
    const [draft, setDraft] = useState<DedicatedDraft>(emptyDraft);

    useEffect(() => {
        if (!view) return;
        setMode(view.mode);
        setDraft(toDraft(view));
    }, [view]);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['ai-voice-carrier', instituteId] });
    };

    const saveMutation = useMutation({
        mutationFn: () =>
            mode === 'PRIMARY'
                ? saveAiVoiceCarrier(instituteId, { mode: 'PRIMARY' })
                : saveAiVoiceCarrier(instituteId, {
                      mode: 'DEDICATED',
                      authId: draft.authId.trim(),
                      authToken: draft.authToken.trim(),
                      callerId: draft.callerId.trim(),
                      appId: draft.appId.trim(),
                      webhookToken: draft.webhookToken.trim(),
                      recordCalls: draft.recordCalls,
                      enabled: draft.enabled,
                  }),
        onSuccess: (updated) => {
            toast.success(
                updated.mode === 'DEDICATED'
                    ? 'AI calls will go out on the dedicated line'
                    : 'AI calls will use your team’s calling account'
            );
            invalidate();
        },
        onError: (err) => toast.error(serverError(err, 'Could not save the AI calling line')),
    });

    const unlinkMutation = useMutation({
        mutationFn: () => unlinkAiVoiceCarrier(instituteId),
        onSuccess: () => {
            toast.success('Dedicated AI line removed');
            invalidate();
        },
        onError: (err) => toast.error(serverError(err, 'Could not remove the line')),
    });

    if (carrierQuery.isLoading) {
        return (
            <Card>
                <CardContent className="py-6">
                    <Skeleton className="h-40 w-full rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    if (carrierQuery.isError || !view) {
        return (
            <Card>
                <CardContent className="py-6">
                    <p className="text-body text-danger-600">
                        Could not load the AI calling line.{' '}
                        <button
                            type="button"
                            className="underline"
                            onClick={() => carrierQuery.refetch()}
                        >
                            Try again
                        </button>
                    </p>
                </CardContent>
            </Card>
        );
    }

    const teamProvider = view.primaryProviderName ?? view.primaryProviderType ?? 'your provider';
    const busy = saveMutation.isPending || unlinkMutation.isPending;

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex flex-col gap-1">
                    <CardTitle className="flex items-center gap-2">
                        <Robot className="text-primary-500" />
                        AI calling line
                    </CardTitle>
                    <CardDescription>
                        Which phone line your AI agent calls from. AI calls need a Vacademy Voice
                        line to stream the conversation — your team’s own calling is unaffected by
                        anything on this card.
                    </CardDescription>
                </div>
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={() => saveMutation.mutate()}
                    disable={busy}
                >
                    {saveMutation.isPending ? 'Saving…' : 'Save'}
                </MyButton>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
                <StatusBanner view={view} />

                <div className="flex flex-col gap-3">
                    <OptionTile
                        icon={<Users />}
                        title="Use our calling account"
                        description={
                            view.primaryCanCarryAi
                                ? `AI calls go out on the same ${teamProvider} account your team calls on.`
                                : `Not available — your team calls on ${teamProvider}, which can’t carry an AI conversation.`
                        }
                        selected={mode === 'PRIMARY'}
                        disabled={!view.primaryCanCarryAi}
                        onSelect={() => setMode('PRIMARY')}
                    />
                    <OptionTile
                        icon={<LinkSimple />}
                        title="Use a separate line for AI calls"
                        description="Link a Vacademy Voice (Plivo) account used only by the AI agent. Your team keeps calling exactly as they do now."
                        selected={mode === 'DEDICATED'}
                        onSelect={() => setMode('DEDICATED')}
                    />
                </div>

                {/* Switching away DELETES the stored Plivo credentials, so it must not be
                    a silent side-effect of a button labelled "Save". */}
                {mode === 'PRIMARY' && view.dedicatedConfigured && (
                    <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3">
                        <Warning className="mt-0.5 shrink-0 text-warning-600" />
                        <span className="text-caption text-warning-800">
                            Saving will remove the dedicated line and its stored Plivo
                            credentials. To pause it instead and keep the credentials, switch
                            back and turn off “Line active”.
                        </span>
                    </div>
                )}

                {mode === 'DEDICATED' && (
                    <section className="flex flex-col gap-4 border-t border-neutral-100 pt-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <MyInput
                                label="Plivo Auth ID"
                                inputType="text"
                                inputPlaceholder="SAxxxxxxxxxxxxxxxxxx"
                                input={draft.authId}
                                onChangeFunction={(e) =>
                                    setDraft((d) => ({ ...d, authId: e.target.value }))
                                }
                            />
                            <MyInput
                                label="Plivo Auth Token"
                                inputType="password"
                                inputPlaceholder={
                                    view.authTokenSet ? 'Saved — leave blank to keep it' : 'Paste the token'
                                }
                                input={draft.authToken}
                                onChangeFunction={(e) =>
                                    setDraft((d) => ({ ...d, authToken: e.target.value }))
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <MyInput
                                label="Caller ID for AI calls"
                                inputType="text"
                                inputPlaceholder="+9180XXXXXXXX"
                                input={draft.callerId}
                                onChangeFunction={(e) =>
                                    setDraft((d) => ({ ...d, callerId: e.target.value }))
                                }
                            />
                            <MyInput
                                label="Plivo Application ID (optional)"
                                inputType="text"
                                inputPlaceholder="Only needed for inbound AI"
                                input={draft.appId}
                                onChangeFunction={(e) =>
                                    setDraft((d) => ({ ...d, appId: e.target.value }))
                                }
                            />
                        </div>
                        <p className="text-caption text-neutral-500">
                            Leads will see this number when the AI calls them — different from the
                            number your counsellors call from.
                        </p>
                        <MyInput
                            label="Webhook token (optional)"
                            inputType="password"
                            inputPlaceholder={
                                view.webhookTokenSet ? 'Saved — leave blank to keep it' : 'Shared secret'
                            }
                            input={draft.webhookToken}
                            onChangeFunction={(e) =>
                                setDraft((d) => ({ ...d, webhookToken: e.target.value }))
                            }
                        />
                        <ToggleRow
                            label="Record AI calls"
                            description="Store the AI conversation securely (private, encrypted)."
                            checked={draft.recordCalls}
                            onChange={(v) => setDraft((d) => ({ ...d, recordCalls: v }))}
                        />
                        <ToggleRow
                            label="Line active"
                            description="Turn off to pause this line — AI calls fall back to your team’s provider."
                            checked={draft.enabled}
                            onChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
                        />

                        {view.dedicatedConfigured && (
                            <div className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-4">
                                <span className="text-caption text-neutral-500">
                                    Removing the line sends AI calls back to your team’s provider.
                                    Call history is kept.
                                </span>
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    onClick={() => unlinkMutation.mutate()}
                                    disable={busy}
                                >
                                    {unlinkMutation.isPending ? 'Removing…' : 'Remove line'}
                                </MyButton>
                            </div>
                        )}
                    </section>
                )}
            </CardContent>
        </Card>
    );
}

function StatusBanner({ view }: { view: AiVoiceCarrierView }) {
    if (view.ready) {
        return (
            <div className="flex items-start gap-2 rounded-lg border border-success-200 bg-success-50 p-3">
                <CheckCircle className="mt-0.5 shrink-0 text-success-600" />
                <span className="text-caption text-success-800">
                    AI calls are ready to go out
                    {view.mode === 'DEDICATED'
                        ? ' on the dedicated line'
                        : ' on your team’s calling account'}
                    {view.callerId ? ` from ${view.callerId}` : ''}.
                </span>
            </div>
        );
    }
    return (
        <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3">
            <Warning className="mt-0.5 shrink-0 text-warning-600" />
            <span className="text-caption text-warning-800">
                {view.blockingReason ?? 'AI calls can’t be placed yet.'}
            </span>
        </div>
    );
}

function OptionTile({
    icon,
    title,
    description,
    selected,
    disabled,
    onSelect,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    selected: boolean;
    disabled?: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={disabled ? undefined : onSelect}
            aria-pressed={selected}
            disabled={disabled}
            className={cn(
                'flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                selected
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300',
                disabled && 'cursor-not-allowed opacity-60 hover:border-neutral-200'
            )}
        >
            <span
                className={cn(
                    'mt-0.5 shrink-0',
                    selected ? 'text-primary-500' : 'text-neutral-400'
                )}
            >
                {icon}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
                <span className="text-subtitle font-semibold text-neutral-700">{title}</span>
                <span className="text-caption text-neutral-500">{description}</span>
            </span>
        </button>
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
