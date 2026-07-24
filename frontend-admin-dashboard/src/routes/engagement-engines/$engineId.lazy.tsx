import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useEffect, useState } from 'react';
import { ArrowLeft, Lightning, PencilSimple, Prohibit, Users } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ToneBadge } from './-components/ToneBadge';
import { TemplateNegotiation } from './-components/TemplateNegotiation';
import { CHANNEL_META } from './-constants';
import { ENGINE_STATUS_META, LANGUAGE_OPTIONS, NEXT_STATUSES } from './-constants';
import {
    useEditPrompt,
    useEngine,
    useEnrollEngine,
    useSetAutonomy,
    useTransitionEngine,
} from './-hooks';
import { autoSendChannels, channelLabels, whatsappEnabled } from './-utils';
import type { EngineDetail } from './-types';
import type { EngineStatus } from './-types';

export const Route = createLazyFileRoute('/engagement-engines/$engineId')({
    component: EngineDetailPage,
});

const STATUS_ACTION_LABEL: Record<string, string> = {
    DRY_RUN: 'Start dry run',
    ACTIVE: 'Activate',
    PAUSED: 'Pause',
    ARCHIVED: 'Archive',
};

function EngineDetailPage() {
    const { engineId } = Route.useParams();
    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();
    const { data, isLoading, isError } = useEngine(engineId);
    const transition = useTransitionEngine();
    const enroll = useEnrollEngine();
    const editPrompt = useEditPrompt();
    const setAutonomy = useSetAutonomy();
    const [amendOpen, setAmendOpen] = useState(false);
    const [delta, setDelta] = useState('');

    useEffect(() => setNavHeading('Engine'), [setNavHeading]);

    if (isLoading) {
        return (
            <LayoutContainer>
                <div className="flex flex-col gap-4 p-1">
                    <Skeleton className="h-8 w-64 rounded" />
                    <Skeleton className="h-40 w-full rounded-lg" />
                </div>
            </LayoutContainer>
        );
    }
    if (isError || !data) {
        return (
            <LayoutContainer>
                <Card className="m-1 p-6 text-center text-body text-danger-600">
                    Could not load this engine.
                </Card>
            </LayoutContainer>
        );
    }

    const { engine, activeMembers, prompt } = data;
    const meta = ENGINE_STATUS_META[engine.status] ?? { label: engine.status, tone: 'neutral' as const };
    const nextStatuses = NEXT_STATUSES[engine.status] ?? [];
    const channels = channelLabels(engine);
    const hasWhatsApp = whatsappEnabled(engine);

    return (
        <LayoutContainer>
            <Helmet>
                <title>{engine.name}</title>
            </Helmet>
            <div className="flex flex-col gap-5 p-1">
                <button
                    type="button"
                    onClick={() => navigate({ to: '/engagement-engines' })}
                    className="flex w-fit items-center gap-1 text-caption text-neutral-500 hover:text-primary-600"
                >
                    <ArrowLeft className="size-4" /> All engines
                </button>

                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-h3 font-semibold text-neutral-700">{engine.name}</h1>
                            <ToneBadge label={meta.label} tone={meta.tone} />
                        </div>
                        {engine.objective && (
                            <p className="mt-1 text-body text-neutral-500">{engine.objective}</p>
                        )}
                    </div>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => navigate({ to: '/engagement-engines/inbox' })}
                    >
                        View task inbox
                    </MyButton>
                </div>

                {/* Status + audience controls */}
                <Card className="flex flex-wrap items-center gap-4 p-4">
                    <div className="flex items-center gap-2">
                        <Users className="size-5 text-neutral-400" />
                        <span className="text-body text-neutral-600">
                            <b>{activeMembers}</b> active member{activeMembers === 1 ? '' : 's'}
                        </span>
                    </div>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        disable={enroll.isPending}
                        onClick={() => enroll.mutate(engine.id)}
                    >
                        {enroll.isPending ? 'Resolving…' : 'Resolve audience'}
                    </MyButton>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        {nextStatuses.map((s: EngineStatus) => (
                            <MyButton
                                key={s}
                                buttonType={s === 'ACTIVE' ? 'primary' : 'secondary'}
                                scale="small"
                                disable={transition.isPending}
                                onClick={() => transition.mutate({ engineId: engine.id, toStatus: s })}
                            >
                                {STATUS_ACTION_LABEL[s] ?? s}
                            </MyButton>
                        ))}
                    </div>
                </Card>

                {engine.status === 'TEMPLATES_PENDING' && hasWhatsApp && (
                    <div className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-caption text-warning-600">
                        This engine sends on WhatsApp — approve at least one template below before it can go
                        live.
                    </div>
                )}

                <div className="grid gap-5 lg:grid-cols-2">
                    {/* Brief */}
                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-subtitle font-semibold text-neutral-700">The brief</p>
                            <MyButton
                                buttonType="text"
                                scale="small"
                                onClick={() => {
                                    setDelta('');
                                    setAmendOpen(true);
                                }}
                            >
                                <PencilSimple className="mr-1 size-4" /> Amend
                            </MyButton>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-body text-neutral-600">
                            {prompt?.compiledText || engine.objective || 'No brief set.'}
                        </p>
                        {prompt && (
                            <p className="mt-2 text-caption text-neutral-400">version {prompt.version}</p>
                        )}
                    </Card>

                    {/* Config summary */}
                    <Card className="flex flex-col gap-2 p-4">
                        <p className="text-subtitle font-semibold text-neutral-700">Configuration</p>
                        <Row label="Channels" value={channels.length ? channels.join(', ') : 'None'} />
                        <Row
                            label="Language"
                            value={
                                LANGUAGE_OPTIONS.find((l) => l.value === engine.language)?.label ??
                                engine.language
                            }
                        />
                        <Row label="Cadence" value={`every ${engine.cadenceHours}h`} />
                    </Card>
                </div>

                <AutonomyPanel
                    detail={data}
                    onToggleKill={(killed) =>
                        setAutonomy.mutate({ engineId: engine.id, killed })
                    }
                    busy={setAutonomy.isPending}
                />

                {hasWhatsApp && (
                    <Card className="p-4">
                        <TemplateNegotiation engineId={engine.id} />
                    </Card>
                )}
            </div>

            {amendOpen && (
                <MyDialog
                    heading="Amend the brief"
                    open={amendOpen}
                    onOpenChange={setAmendOpen}
                    dialogWidth="max-w-lg"
                >
                    <div className="flex flex-col gap-3 p-1">
                        <p className="text-caption text-neutral-500">
                            The brief grows by amendment — this is appended, the original is never rewritten.
                            It applies at each person&apos;s next natural check-in.
                        </p>
                        <Textarea
                            rows={5}
                            value={delta}
                            onChange={(e) => setDelta(e.target.value)}
                            placeholder="e.g. Also mention the new weekend batch starting next month."
                        />
                        <div className="flex justify-end gap-2">
                            <MyButton buttonType="secondary" scale="small" onClick={() => setAmendOpen(false)}>
                                Cancel
                            </MyButton>
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                disable={editPrompt.isPending || !delta.trim()}
                                onClick={() =>
                                    editPrompt.mutate(
                                        { engineId: engine.id, deltaText: delta.trim() },
                                        { onSuccess: () => setAmendOpen(false) }
                                    )
                                }
                            >
                                {editPrompt.isPending ? 'Saving…' : 'Add amendment'}
                            </MyButton>
                        </div>
                    </div>
                </MyDialog>
            )}
        </LayoutContainer>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-body text-neutral-500">{label}</span>
            <span className="text-body font-medium text-neutral-700">{value}</span>
        </div>
    );
}

function AutonomyStatusBadge({
    killed,
    graduated,
    approved,
    target,
    engineStatus,
}: {
    killed: boolean;
    graduated: boolean;
    approved: number;
    target: number;
    engineStatus: EngineStatus;
}) {
    if (killed) return <ToneBadge label="Autonomy off (copilot)" tone="neutral" />;
    if (!graduated)
        return <ToneBadge label={`Ramping · ${approved}/${target} approved`} tone="warning" />;
    // Graduated + auto-on, but the badge must not claim live sending unless the engine is ACTIVE —
    // a PAUSED/DRAFT engine sends nothing, and DRY_RUN only simulates.
    if (engineStatus === 'ACTIVE') return <ToneBadge label="Sending autonomously" tone="success" />;
    if (engineStatus === 'DRY_RUN') return <ToneBadge label="Dry run (simulated)" tone="info" />;
    const statusLabel = ENGINE_STATUS_META[engineStatus]?.label ?? engineStatus;
    return <ToneBadge label={`Autonomy on · engine ${statusLabel.toLowerCase()}`} tone="neutral" />;
}

function AutonomyPanel({
    detail,
    onToggleKill,
    busy,
}: {
    detail: EngineDetail;
    onToggleKill: (killed: boolean) => void;
    busy: boolean;
}) {
    const { engine, approvedSends, effectiveFirstN } = detail;
    const autoChannels = autoSendChannels(engine);
    // Only meaningful once at least one channel is set to auto-send, or a holdout exists.
    if (autoChannels.length === 0 && !(engine.holdoutPct && engine.holdoutPct > 0)) return null;

    const killed = engine.autoSendKilled === true;
    const target = effectiveFirstN ?? 0;
    const approved = approvedSends ?? 0;
    const graduated = target <= 0 || approved >= target;

    return (
        <Card className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Lightning className="size-5 text-primary-500" />
                    <p className="text-subtitle font-semibold text-neutral-700">Autonomy</p>
                </div>
                {autoChannels.length > 0 &&
                    (killed ? (
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            disable={busy}
                            onClick={() => onToggleKill(false)}
                        >
                            Allow auto-send
                        </MyButton>
                    ) : (
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            disable={busy}
                            onClick={() => onToggleKill(true)}
                        >
                            <Prohibit className="mr-1 size-4" /> Keep as copilot
                        </MyButton>
                    ))}
            </div>

            {autoChannels.length > 0 ? (
                <>
                    <Row
                        label="Auto-send channels"
                        value={autoChannels.map((c) => CHANNEL_META[c].label).join(', ')}
                    />
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-body text-neutral-500">Status</span>
                        <AutonomyStatusBadge
                            killed={killed}
                            graduated={graduated}
                            approved={approved}
                            target={target}
                            engineStatus={engine.status}
                        />
                    </div>
                    {!killed && !graduated && (
                        <p className="text-caption text-neutral-500">
                            Still copilot — send {Math.max(0, target - approved)} more approved draft(s)
                            and this engine graduates to sending on its own.
                        </p>
                    )}
                </>
            ) : (
                <p className="text-caption text-neutral-500">
                    No auto-send channels — this engine only drafts tasks for you to send.
                </p>
            )}

            {engine.holdoutPct != null && engine.holdoutPct > 0 && (
                <Row label="Holdout" value={`${engine.holdoutPct}% (enrolled, never messaged)`} />
            )}
        </Card>
    );
}
