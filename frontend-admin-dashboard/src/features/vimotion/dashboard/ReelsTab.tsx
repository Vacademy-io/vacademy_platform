import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Film,
    Plus,
    Scissors,
} from 'lucide-react';
import { VimotionLoader } from '../brand/VimotionLoader';
import { cn } from '@/lib/utils';
import { getInstituteId } from '@/constants/helper';
import { useVimotionApiKey } from './hooks/useVimotionApiKey';
import { useReelsList } from '../reels/hooks/useReelsList';
import { stageLabel } from '../reels/detail/StageProgressList';
import type { ReelResponse, ReelStatus } from '../reels/services/reels-api';

type StatusFilter = 'all' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export function ReelsTab() {
    const instituteId = getInstituteId();
    const apiKey = useVimotionApiKey(instituteId);
    const navigate = useNavigate();
    const [filter, setFilter] = useState<StatusFilter>('all');

    const reelsQuery = useReelsList({
        apiKey: apiKey.data,
        instituteId,
    });

    const filteredReels = useMemo(() => {
        const data = reelsQuery.data ?? [];
        if (filter === 'all') return data;
        if (filter === 'IN_PROGRESS') {
            return data.filter((r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS');
        }
        return data.filter((r) => r.status === filter);
    }, [reelsQuery.data, filter]);

    const startNewReel = () => {
        navigate({ to: '/vim/reels/new', search: {} });
    };

    if (apiKey.isError) {
        return <ErrorState message="Could not connect to the video service. Please try again." />;
    }

    return (
        <div className="space-y-5">
            {/* Toolbar — filter chips + new-reel button */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                    <FilterChip current={filter} value="all" onClick={setFilter}>
                        All
                    </FilterChip>
                    <FilterChip current={filter} value="IN_PROGRESS" onClick={setFilter}>
                        In progress
                    </FilterChip>
                    <FilterChip current={filter} value="COMPLETED" onClick={setFilter}>
                        Ready
                    </FilterChip>
                    <FilterChip current={filter} value="FAILED" onClick={setFilter}>
                        Failed
                    </FilterChip>
                </div>
                <button
                    type="button"
                    onClick={startNewReel}
                    disabled={!apiKey.data}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-neutral-900 px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Plus className="size-4" />
                    New reel
                </button>
            </div>

            {/* Grid */}
            {apiKey.isLoading || reelsQuery.isLoading ? (
                <LoadingGrid />
            ) : reelsQuery.isError ? (
                <ErrorState message="Could not load your reels. Please refresh." />
            ) : filteredReels.length === 0 ? (
                <EmptyState
                    onStart={startNewReel}
                    hasAny={!!reelsQuery.data?.length}
                    filter={filter}
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredReels.map((reel) => (
                        <ReelCard key={reel.id} reel={reel} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Filter chip — matches AssetsTab styling exactly so the two surfaces feel
// like siblings. If we ever theme one differently the cross-tab consistency
// is the first thing to maintain.
// ---------------------------------------------------------------------------

function FilterChip({
    current,
    value,
    onClick,
    children,
}: {
    current: StatusFilter;
    value: StatusFilter;
    onClick: (v: StatusFilter) => void;
    children: React.ReactNode;
}) {
    const active = current === value;
    return (
        <button
            type="button"
            onClick={() => onClick(value)}
            className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                active
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50'
            )}
        >
            {children}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Card — one reel
// ---------------------------------------------------------------------------

function ReelCard({ reel }: { reel: ReelResponse }) {
    const navigate = useNavigate();
    const videoUrl = reel.s3_urls?.video;
    const isCompleted = reel.status === 'COMPLETED';
    const title =
        (reel.config?.enriched_snapshot as { title?: string } | undefined)?.title ?? reel.reel_id;
    const aspect = (reel.config?.aspect as string | undefined) ?? '9:16';

    const handleClick = () => {
        // Slice 4 ships /vim/reels/$reelId — for now we just route to it
        // and let the placeholder render. Working FE state for in-progress
        // and completed reels lands when the detail route is implemented.
        navigate({
            to: '/vim/reels/$reelId',
            params: { reelId: reel.reel_id },
        });
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition-colors hover:border-neutral-300"
        >
            <div className="relative aspect-video w-full bg-neutral-100">
                {isCompleted && videoUrl ? (
                    <video
                        src={videoUrl}
                        muted
                        preload="metadata"
                        className="size-full object-cover"
                    />
                ) : (
                    <div className="flex size-full items-center justify-center text-neutral-400">
                        <Film className="size-8" />
                    </div>
                )}
                <ReelStatusBadge status={reel.status} progress={reel.progress} />
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
                    <Scissors className="size-3" />
                    {aspect}
                </span>
            </div>
            <div className="flex flex-col gap-1 p-3.5">
                <p className="line-clamp-2 text-sm font-medium text-neutral-900">{title}</p>
                <p className="text-xs text-neutral-500">{describeReel(reel)}</p>
            </div>
        </button>
    );
}

function describeReel(reel: ReelResponse): string {
    const parts: string[] = [];
    if (reel.status !== 'COMPLETED') {
        // current_stage is a raw pipeline key (e.g. AUDIO_EDIT) — translate
        // to creator language before it reaches the card.
        parts.push(stageLabel(reel.current_stage));
    }
    const window = reel.source_window as { t_start?: number; t_end?: number } | undefined;
    if (window?.t_start != null && window?.t_end != null) {
        const sec = Math.round(window.t_end - window.t_start);
        parts.push(`${sec}s clip`);
    }
    if (reel.created_at) parts.push(formatTimestamp(reel.created_at));
    return parts.join(' · ');
}

function ReelStatusBadge({ status, progress }: { status: ReelStatus; progress: number }) {
    const config: Record<ReelStatus, { label: string; Icon: typeof CheckCircle2; cls: string }> = {
        COMPLETED: {
            label: 'Ready',
            Icon: CheckCircle2,
            cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        },
        IN_PROGRESS: {
            label: `${progress || 0}%`,
            Icon: CheckCircle2,
            cls: 'bg-blue-50 text-blue-700 border-blue-200',
        },
        PENDING: {
            label: 'Queued',
            Icon: Clock,
            cls: 'bg-neutral-50 text-neutral-700 border-neutral-200',
        },
        FAILED: {
            label: 'Failed',
            Icon: AlertCircle,
            cls: 'bg-red-50 text-red-700 border-red-200',
        },
    };
    const { label, Icon, cls } = config[status];
    const spinning = status === 'IN_PROGRESS';
    return (
        <span
            className={cn(
                'absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                cls
            )}
        >
            {spinning ? (
                <VimotionLoader size={12} className="text-blue-700" label="Rendering" />
            ) : (
                <Icon className="size-3" />
            )}
            {label}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Empty / loading / error
// ---------------------------------------------------------------------------

function EmptyState({
    onStart,
    hasAny,
    filter,
}: {
    onStart: () => void;
    hasAny: boolean;
    filter: StatusFilter;
}) {
    if (hasAny && filter !== 'all') {
        return (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
                No reels match this filter — switch back to All or try a different one.
            </div>
        );
    }
    return (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-neutral-50 ring-1 ring-neutral-200">
                <Scissors className="size-5 text-primary-500" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-neutral-900">No reels yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
                Cut highly engaging short clips from any of your indexed long-form videos.
                We’ll suggest candidate moments and render them on confirmation.
            </p>
            <button
                type="button"
                onClick={onStart}
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-neutral-900 px-5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
            >
                <Plus className="size-4" />
                Create your first reel
            </button>
        </div>
    );
}

function LoadingGrid() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <div className="aspect-video w-full animate-pulse bg-neutral-100" />
                    <div className="space-y-2 p-3.5">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-100" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="size-4" />
                {message}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const now = Date.now();
    const diffSec = Math.floor((now - date.getTime()) / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
