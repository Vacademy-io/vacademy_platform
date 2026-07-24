import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, PhoneCall, Robot } from '@phosphor-icons/react';
import { MyDialog } from '@/components/design-system/dialog';
import { cn } from '@/lib/utils';
import {
    fetchAiCampaignStatus,
    type AiCampaignCallStatus,
} from '@/components/shared/leads/services/start-ai-campaign';

interface CampaignProgressDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    audienceId: string;
    instituteId: string;
    /** Epoch ms when the run started — the status endpoint returns calls since then. */
    startedAtMs: number;
    /** How many calls this run will place (drives the progress header). */
    expectedTotal: number;
    /** responseId → lead name, for labeling rows (best-effort; falls back to number). */
    leadNames: Map<string, string>;
    /** Calls-in-parallel chosen for this run (display only). */
    parallel: number;
}

const TERMINAL = new Set(['COMPLETED', 'NO_ANSWER', 'BUSY', 'FAILED', 'CANCELLED']);

/** status → chip label + design-token classes (semantic tokens only). */
function chip(status: string): { label: string; cls: string; live?: boolean } {
    switch (status) {
        case 'COMPLETED':
            return { label: 'Completed', cls: 'bg-success-50 text-success-700' };
        case 'NO_ANSWER':
            return { label: 'No answer', cls: 'bg-warning-50 text-warning-700' };
        case 'BUSY':
            return { label: 'Busy', cls: 'bg-warning-50 text-warning-700' };
        case 'FAILED':
            return { label: 'Failed', cls: 'bg-danger-50 text-danger-700' };
        case 'CANCELLED':
            return { label: 'Cancelled', cls: 'bg-danger-50 text-danger-700' };
        case 'ANSWERED':
        case 'IN_PROGRESS':
            return { label: 'On call', cls: 'bg-info-50 text-info-700', live: true };
        case 'COUNSELLOR_RINGING':
            return { label: 'Ringing', cls: 'bg-info-50 text-info-700', live: true };
        default: // INITIATED / QUEUED
            return { label: 'Dialing', cls: 'bg-neutral-100 text-neutral-600', live: true };
    }
}

/**
 * Live progress for a bulk AI-call run: one row per dialed lead, status updating
 * every few seconds (poll — call events land via provider webhooks server-side, so
 * closing this dialog never affects the run). Polling stops once every expected
 * call has reached a terminal state.
 */
export function CampaignProgressDialog({
    open,
    onOpenChange,
    audienceId,
    instituteId,
    startedAtMs,
    expectedTotal,
    leadNames,
    parallel,
}: CampaignProgressDialogProps) {
    const [finished, setFinished] = useState(false);
    // Rows persist across polls even if a poll fails transiently.
    const rowsRef = useRef<Map<string, AiCampaignCallStatus>>(new Map());
    const [, bump] = useState(0);

    const poll = useQuery({
        queryKey: ['ai-campaign-progress', audienceId, startedAtMs],
        queryFn: () => fetchAiCampaignStatus(audienceId, instituteId, startedAtMs),
        enabled: open && !finished,
        refetchInterval: 4000,
        retry: false,
    });

    useEffect(() => {
        if (!poll.data) return;
        for (const row of poll.data) rowsRef.current.set(row.callLogId, row);
        bump((n) => n + 1);
        const rows = Array.from(rowsRef.current.values());
        const done = rows.filter((r) => TERMINAL.has(r.status)).length;
        if (expectedTotal > 0 && done >= expectedTotal) setFinished(true);
    }, [poll.data, expectedTotal]);

    useEffect(() => {
        if (open) {
            rowsRef.current = new Map();
            setFinished(false);
        }
    }, [open, startedAtMs]);

    const rows = useMemo(
        () =>
            Array.from(rowsRef.current.values()).sort((a, b) =>
                (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [poll.dataUpdatedAt]
    );
    const doneCount = rows.filter((r) => TERMINAL.has(r.status)).length;
    const liveCount = rows.length - doneCount;

    return (
        <MyDialog
            heading="AI calls in progress"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="w-full max-w-lg"
        >
            <div className="space-y-3 text-body">
                <div className="flex items-center justify-between">
                    <p className="font-semibold">
                        {finished ? (
                            <span className="flex items-center gap-1.5 text-success-700">
                                <CheckCircle className="size-4" /> All {expectedTotal} calls finished
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                <Robot className="size-4 text-primary-500" />
                                {doneCount} of {expectedTotal} completed
                                {liveCount > 0 && ` · ${liveCount} live`}
                            </span>
                        )}
                    </p>
                    <span className="text-caption text-neutral-500">{parallel} at a time</span>
                </div>

                {/* progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-lg bg-neutral-100">
                    <div
                        className="h-full rounded-lg bg-primary-500 transition-all"
                        // inline style: genuinely dynamic value (live completion %),
                        // not expressible as a token class
                        style={{
                            width: `${expectedTotal ? Math.min(100, Math.round((doneCount / expectedTotal) * 100)) : 0}%`,
                        }}
                    />
                </div>

                <div className="max-h-72 space-y-1.5 overflow-y-auto">
                    {rows.length === 0 && (
                        <p className="flex items-center gap-1.5 py-3 text-neutral-500">
                            <PhoneCall className="size-4 animate-pulse" /> Dialing the first lead…
                        </p>
                    )}
                    {rows.map((r) => {
                        const c = chip(r.status);
                        return (
                            <div
                                key={r.callLogId}
                                className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-body font-medium">
                                        {leadNames.get(r.responseId) ?? 'Lead'}
                                    </p>
                                    <p className="text-caption text-neutral-500">
                                        {r.disposition
                                            ? r.disposition
                                            : r.durationSeconds
                                              ? `${Math.floor(r.durationSeconds / 60)}m ${r.durationSeconds % 60}s`
                                              : ''}
                                    </p>
                                </div>
                                <span
                                    className={cn(
                                        'shrink-0 rounded-md px-2 py-0.5 text-caption font-medium',
                                        c.cls,
                                        c.live && 'animate-pulse'
                                    )}
                                >
                                    {c.label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {poll.isError && (
                    <p className="text-caption text-warning-600">
                        Live updates paused (retrying) — the calls keep running server-side.
                    </p>
                )}
                {!finished && (
                    <p className="text-caption text-neutral-500">
                        Runs in the background — closing this window does not stop the calls.
                        Outcomes and counsellor assignment land automatically after each call.
                    </p>
                )}
            </div>
        </MyDialog>
    );
}
