import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ClipboardText,
    Code,
    FileText,
    ListChecks,
    PencilLine,
    Question,
    SpeakerHigh,
    VideoCamera,
    Users,
    type Icon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { pulseSummaryQueryOptions } from '../../-services/pulse-services';
import type { PulseRosterRow, PulseState } from '../../-types/pulse-types';

const SLIDE_ICON: Record<string, Icon> = {
    DOCUMENT: FileText,
    PDF: FileText,
    DOC: FileText,
    VIDEO: VideoCamera,
    HTML_VIDEO: VideoCamera,
    AUDIO: SpeakerHigh,
    QUESTION: Question,
    QUIZ: ListChecks,
    ASSESSMENT: ClipboardText,
    ASSIGNMENT: PencilLine,
    CODE: Code,
};

const STATE_META: Record<PulseState, { label: string; chip: string; rail: string }> = {
    NEEDS_HELP: {
        label: 'Needs help',
        chip: 'bg-danger-50 text-danger-600',
        rail: 'bg-danger-500',
    },
    IDLE: {
        label: 'Idle',
        chip: 'bg-warning-50 text-warning-600',
        rail: 'bg-warning-500',
    },
    ACTIVE: {
        label: 'Active',
        chip: 'bg-success-50 text-success-600',
        rail: 'bg-success-500',
    },
};

function formatDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`;
    return `${sec}s`;
}

function KpiCard({
    label,
    value,
    hint,
    tone,
}: {
    label: string;
    value: number;
    hint: string;
    tone: string;
}) {
    return (
        <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
            <span className={cn('absolute inset-y-0 left-0 w-1', tone)} />
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {label}
            </p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-neutral-700">{value}</p>
            <p className="text-xs text-neutral-400">{hint}</p>
        </div>
    );
}

function RosterRow({ row, secondsSinceFetch }: { row: PulseRosterRow; secondsSinceFetch: number }) {
    const meta = STATE_META[row.state];
    const Icon = SLIDE_ICON[row.slideType] ?? FileText;
    const liveSeconds = row.onSlideSeconds + secondsSinceFetch;
    const initials = (row.fullName ?? '?')
        .split(' ')
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div className="relative flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0 hover:bg-neutral-50">
            <span className={cn('absolute inset-y-0 left-0 w-1', meta.rail)} />
            <div
                className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    meta.chip
                )}
            >
                {initials}
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-700">
                    {row.fullName ?? 'Unknown learner'}
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-neutral-500">
                    <Icon size={14} className="shrink-0 text-neutral-400" />
                    <span className="truncate">{row.slideTitle ?? 'Untitled slide'}</span>
                </p>
            </div>

            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', meta.chip)}>
                {meta.label}
            </span>

            <span className="w-16 shrink-0 text-right text-sm font-medium tabular-nums text-neutral-600">
                {formatDuration(liveSeconds)}
            </span>
        </div>
    );
}

export default function PulseTab({ packageSessionId }: { packageSessionId: string }) {
    const batchId = (packageSessionId ?? '').split(',')[0] ?? '';

    const { data, isLoading, isError, refetch, dataUpdatedAt, isFetching } = useQuery(
        pulseSummaryQueryOptions(batchId)
    );

    // Single shared 1s ticker so "reading for N min" counts up between polls,
    // measuring only the delta since the last successful fetch (never a client clock).
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);
    const secondsSinceFetch = dataUpdatedAt ? Math.max(0, Math.floor((now - dataUpdatedAt) / 1000)) : 0;

    const counts = data?.counts;
    const roster = useMemo(() => data?.roster ?? [], [data]);

    if (!batchId) {
        return (
            <div className="rounded-md bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
                Select a batch to view its live pulse.
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center rounded-md bg-white p-10 shadow-sm">
                <DashboardLoader />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-md bg-white p-8 text-center shadow-sm">
                <p className="text-sm font-medium text-danger-600">Couldn&apos;t load live pulse.</p>
                <p className="mt-1 text-xs text-neutral-500">
                    Check your connection and try again.
                </p>
                <button
                    onClick={() => refetch()}
                    className="mt-3 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-400 hover:text-neutral-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-1">
            {/* Live status line */}
            <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-400 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary-500" />
                </span>
                Live{isFetching ? ' · refreshing…' : ` · updated ${secondsSinceFetch}s ago`}
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
                <KpiCard
                    label="Active now"
                    value={counts?.active ?? 0}
                    hint="seen in last 2 min"
                    tone="bg-success-500"
                />
                <KpiCard
                    label="Idle"
                    value={counts?.idle ?? 0}
                    hint="open, not engaging"
                    tone="bg-warning-500"
                />
                <KpiCard
                    label="Offline"
                    value={counts?.offline ?? 0}
                    hint={`of ${counts?.enrolled ?? 0} enrolled`}
                    tone="bg-neutral-300"
                />
                <KpiCard
                    label="Need help"
                    value={counts?.needHelp ?? 0}
                    hint="stuck on a slide"
                    tone="bg-danger-500"
                />
                <KpiCard
                    label="Enrolled"
                    value={counts?.enrolled ?? 0}
                    hint="in this batch"
                    tone="bg-primary-500"
                />
            </div>

            {/* Roster */}
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Roster · needs attention first
                    </p>
                    {data && data.totalPresent > roster.length && (
                        <p className="text-xs text-neutral-400">
                            showing {roster.length} of {data.totalPresent} active
                        </p>
                    )}
                </div>

                {roster.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                        <Users size={28} className="text-neutral-300" />
                        <p className="text-sm font-medium text-neutral-500">
                            No one&apos;s active in this batch right now
                        </p>
                        <p className="text-xs text-neutral-400">
                            Learners appear here the moment they open a slide.
                        </p>
                    </div>
                ) : (
                    roster.map((row) => (
                        <RosterRow
                            key={row.userId}
                            row={row}
                            secondsSinceFetch={secondsSinceFetch}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
