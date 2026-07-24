import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, PaperPlaneTilt } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyPagination } from '@/components/design-system/pagination';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ToneBadge } from '../-components/ToneBadge';
import { ACTION_STATUS_META, CHANNEL_META } from '../-constants';
import { useEngines, useTaskAction, useTasks } from '../-hooks';
import { safeParse } from '../-utils';
import type { EngagementAction } from '../-types';

export const Route = createLazyFileRoute('/engagement-engines/inbox/')({
    component: TaskInboxPage,
});

const FILTERS: { label: string; statuses: string }[] = [
    { label: 'Needs action', statuses: 'OPEN,ACKED' },
    { label: 'Sent', statuses: 'SENT' },
    { label: 'Failed', statuses: 'FAILED' },
    { label: 'Handled', statuses: 'DONE,DISMISSED' },
];

const PAGE_SIZE = 20;

function TaskInboxPage() {
    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();
    const [filterIdx, setFilterIdx] = useState(0);
    const [page, setPage] = useState(0);
    const [sending, setSending] = useState<EngagementAction | null>(null);

    useEffect(() => setNavHeading('Task inbox'), [setNavHeading]);

    const statuses = FILTERS[filterIdx]?.statuses ?? 'OPEN,ACKED';
    const { data, isLoading, isError } = useTasks(statuses, page, PAGE_SIZE);
    const { data: engines } = useEngines();
    const engineNames = useMemo(() => {
        const m: Record<string, string> = {};
        (engines ?? []).forEach((e) => (m[e.id] = e.name));
        return m;
    }, [engines]);

    const action = useTaskAction();
    const tasks = data?.content ?? [];

    return (
        <LayoutContainer>
            <Helmet>
                <title>Engagement task inbox</title>
            </Helmet>
            <div className="flex flex-col gap-4 p-1">
                <button
                    type="button"
                    onClick={() => navigate({ to: '/engagement-engines' })}
                    className="flex w-fit items-center gap-1 text-caption text-neutral-500 hover:text-primary-600"
                >
                    <ArrowLeft className="size-4" /> All engines
                </button>
                <div>
                    <h1 className="text-h3 font-semibold text-neutral-700">Task inbox</h1>
                    <p className="text-body text-neutral-500">
                        Every message the engines drafted, ranked by priority. Review, edit, and send.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {FILTERS.map((f, i) => (
                        <button
                            key={f.label}
                            type="button"
                            onClick={() => {
                                setFilterIdx(i);
                                setPage(0);
                            }}
                            className={cn(
                                'rounded-full border px-3 py-1 text-body transition-colors',
                                i === filterIdx
                                    ? 'border-primary-500 bg-primary-50 text-primary-600'
                                    : 'border-neutral-200 text-neutral-500 hover:border-primary-200'
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {isLoading && <Skeleton className="h-40 w-full rounded-lg" />}
                {isError && (
                    <Card className="p-6 text-center text-body text-danger-600">Could not load tasks.</Card>
                )}
                {!isLoading && !isError && tasks.length === 0 && (
                    <Card className="p-10 text-center text-body text-neutral-500">
                        Nothing here right now.
                    </Card>
                )}

                <div className="flex flex-col gap-3">
                    {tasks.map((t) => (
                        <TaskCard
                            key={t.id}
                            task={t}
                            engineName={engineNames[t.engineId]}
                            busy={action.isPending}
                            onAck={() => action.mutate({ taskId: t.id, verb: 'ack' })}
                            onDone={() => action.mutate({ taskId: t.id, verb: 'done' })}
                            onDismiss={() => action.mutate({ taskId: t.id, verb: 'dismiss' })}
                            onReopen={() => action.mutate({ taskId: t.id, verb: 'reopen' })}
                            onSend={() => setSending(t)}
                        />
                    ))}
                </div>

                {(data?.totalPages ?? 0) > 1 && (
                    <MyPagination
                        currentPage={page}
                        totalPages={data?.totalPages ?? 1}
                        onPageChange={setPage}
                    />
                )}
            </div>

            {sending && (
                <SendDialog
                    task={sending}
                    onClose={() => setSending(null)}
                    onConfirm={(editedBody) =>
                        action.mutate(
                            { taskId: sending.id, verb: 'send', editedBody },
                            { onSuccess: () => setSending(null) }
                        )
                    }
                    sending={action.isPending}
                />
            )}
        </LayoutContainer>
    );
}

function TaskCard({
    task,
    engineName,
    busy,
    onAck,
    onDone,
    onDismiss,
    onReopen,
    onSend,
}: {
    task: EngagementAction;
    engineName?: string;
    busy: boolean;
    onAck: () => void;
    onDone: () => void;
    onDismiss: () => void;
    onReopen: () => void;
    onSend: () => void;
}) {
    const statusMeta = ACTION_STATUS_META[task.status] ?? { label: task.status, tone: 'neutral' as const };
    const channelLabel = task.channel ? CHANNEL_META[task.channel]?.label ?? task.channel : '—';
    const isReply = task.kind === 'REPLY';
    const isAutoSend = task.kind === 'SEND';
    const canSend =
        (task.status === 'OPEN' || task.status === 'ACKED') &&
        !!task.channel &&
        task.channel !== 'AI_CALL';
    const canHandle = task.status === 'OPEN' || task.status === 'ACKED';

    return (
        <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    {isReply && <ToneBadge label="Reply" tone="info" />}
                    {isAutoSend && <ToneBadge label="Auto-send" tone="warning" />}
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-caption text-neutral-500">
                        {channelLabel}
                    </span>
                    {engineName && <span className="text-caption text-neutral-400">{engineName}</span>}
                    {typeof task.priority === 'number' && (
                        <span className="text-caption text-neutral-400">
                            priority {Math.round(task.priority)}
                        </span>
                    )}
                </div>
                <ToneBadge label={statusMeta.label} tone={statusMeta.tone} />
            </div>

            {task.rationale && (
                <p className="mt-2 text-caption italic text-neutral-500">{task.rationale}</p>
            )}
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-body text-neutral-700">
                {task.sentBody || task.draftBody || '(no draft)'}
            </p>
            {task.status === 'FAILED' && task.errorMessage && (
                <p className="mt-2 rounded bg-danger-50 p-2 text-caption text-danger-600">
                    {task.errorMessage}
                </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
                {canSend && (
                    <MyButton buttonType="primary" scale="small" disable={busy} onClick={onSend}>
                        <PaperPlaneTilt className="mr-1 size-3.5" /> Review &amp; send
                    </MyButton>
                )}
                {canHandle && task.status === 'OPEN' && (
                    <MyButton buttonType="secondary" scale="small" disable={busy} onClick={onAck}>
                        Acknowledge
                    </MyButton>
                )}
                {canHandle && (
                    <>
                        <MyButton buttonType="secondary" scale="small" disable={busy} onClick={onDone}>
                            Handled elsewhere
                        </MyButton>
                        <MyButton buttonType="text" scale="small" disable={busy} onClick={onDismiss}>
                            Dismiss
                        </MyButton>
                    </>
                )}
                {task.status === 'FAILED' && (
                    <MyButton buttonType="secondary" scale="small" disable={busy} onClick={onReopen}>
                        Reopen
                    </MyButton>
                )}
            </div>
        </Card>
    );
}

function SendDialog({
    task,
    onClose,
    onConfirm,
    sending,
}: {
    task: EngagementAction;
    onClose: () => void;
    onConfirm: (editedBody?: string) => void;
    sending: boolean;
}) {
    // A proactive WhatsApp template's text is FIXED (Meta-approved) — it can't be edited; only its
    // variables vary. A WhatsApp REPLY and email/in-app are free-form and editable.
    const isFixedTemplate = task.channel === 'WHATSAPP' && task.kind !== 'REPLY' && !!task.templateName;
    const vars = safeParse<Record<string, string>>(task.variablesJson, {});
    const [body, setBody] = useState(task.draftBody ?? '');

    return (
        <MyDialog heading="Review & send" open onOpenChange={(o) => !o && onClose()} dialogWidth="max-w-lg">
            <div className="flex flex-col gap-3 p-1">
                {isFixedTemplate ? (
                    <>
                        <p className="rounded bg-info-50 p-2 text-caption text-info-600">
                            This is a fixed Meta-approved WhatsApp template. The text can&apos;t be edited —
                            only its variables. This is exactly what will be sent:
                        </p>
                        <p className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-body text-neutral-700">
                            {task.draftBody}
                        </p>
                        {Object.keys(vars).length > 0 && (
                            <div className="rounded-lg border border-neutral-200 p-2">
                                <p className="mb-1 text-caption text-neutral-500">Variables</p>
                                {Object.entries(vars).map(([k, v]) => (
                                    <div key={k} className="flex justify-between text-caption text-neutral-600">
                                        <span className="text-neutral-400">{k}</span>
                                        <span>{v}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <p className="text-caption text-neutral-500">
                            Edit before sending if you like — your edit is what goes out.
                        </p>
                        <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
                    </>
                )}
                <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
                    <MyButton buttonType="secondary" scale="small" onClick={onClose}>
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        disable={sending || (!isFixedTemplate && !body.trim())}
                        onClick={() => onConfirm(isFixedTemplate ? undefined : body)}
                    >
                        {sending ? 'Sending…' : 'Send now'}
                    </MyButton>
                </div>
            </div>
        </MyDialog>
    );
}
