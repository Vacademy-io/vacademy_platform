import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clapperboard,
    Clock,
    Loader2,
    PlayCircle,
} from 'lucide-react';
import { getInstituteId } from '@/constants/helper';
import {
    getRemoteHistory,
    type HistoryItem,
} from '@/routes/video-api-studio/-services/video-generation';
import { cn } from '@/lib/utils';
import { useVimotionApiKey } from './hooks/useVimotionApiKey';

const PAGE_SIZE = 20;

export function RecentTab() {
    const instituteId = getInstituteId();
    const apiKey = useVimotionApiKey(instituteId);

    const history = useQuery({
        queryKey: ['vimotion-history', instituteId, apiKey.data],
        queryFn: () => getRemoteHistory(apiKey.data!, PAGE_SIZE, 0),
        enabled: !!apiKey.data,
        staleTime: 30_000,
    });

    if (apiKey.isError) {
        return <ErrorState message="Could not connect to the video service. Please try again." />;
    }

    if (apiKey.isLoading || history.isLoading) {
        return <LoadingGrid />;
    }

    if (history.isError) {
        return <ErrorState message="Could not load your recent videos. Please refresh." />;
    }

    const items = history.data ?? [];

    if (items.length === 0) {
        return <EmptyState />;
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
                <HistoryCard key={item.id} item={item} />
            ))}
        </div>
    );
}

function HistoryCard({ item }: { item: HistoryItem }) {
    // Only completed videos have artifacts to render in the production view.
    // Generating/pending/failed items aren't clickable here — users wait or
    // retry from the workspace itself (once we wire that into Recent later).
    const isViewable = item.status === 'completed' && !!item.html_url;
    const ts = formatTimestamp(item.created_at);
    const title = (item.prompt || '').trim() || 'Untitled video';

    const cardClasses = cn(
        'group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-colors',
        isViewable ? 'hover:border-neutral-300' : 'cursor-default'
    );

    const inner = (
        <>
            <div className="relative aspect-video w-full bg-neutral-100">
                <div className="flex size-full items-center justify-center text-neutral-400">
                    <Clapperboard className="size-8" />
                </div>
                {isViewable && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="flex size-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                            <PlayCircle className="size-6" />
                        </div>
                    </div>
                )}
                <StatusBadge status={item.status} />
            </div>
            <div className="flex flex-col gap-1 p-4">
                <p className="line-clamp-2 text-sm font-medium text-neutral-900">{title}</p>
                <p className="text-xs text-neutral-500">{ts}</p>
            </div>
        </>
    );

    if (!isViewable) {
        return <div className={cardClasses}>{inner}</div>;
    }

    return (
        <Link to="/vim/dashboard" search={{ videoId: item.video_id }} className={cardClasses}>
            {inner}
        </Link>
    );
}

function StatusBadge({ status }: { status: HistoryItem['status'] }) {
    const config = {
        completed: {
            label: 'Ready',
            Icon: CheckCircle2,
            className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        },
        generating: {
            label: 'Generating',
            Icon: Loader2,
            className: 'bg-blue-50 text-blue-700 border-blue-200',
        },
        pending: {
            label: 'Queued',
            Icon: Clock,
            className: 'bg-neutral-50 text-neutral-700 border-neutral-200',
        },
        failed: {
            label: 'Failed',
            Icon: AlertCircle,
            className: 'bg-red-50 text-red-700 border-red-200',
        },
    } as const;
    const { label, Icon, className } = config[status] ?? config.pending;
    return (
        <span
            className={cn(
                'absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                className
            )}
        >
            <Icon className={cn('size-3', status === 'generating' && 'animate-spin')} />
            {label}
        </span>
    );
}

function EmptyState() {
    return (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-neutral-50 ring-1 ring-neutral-200">
                <Clapperboard className="size-5 text-primary-500" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-neutral-900">No creatives yet</h2>
            <p className="mt-2 max-w-md text-sm text-neutral-500" style={{ marginInline: 'auto' }}>
                Once you generate your first video, it&rsquo;ll show up here with a thumbnail,
                duration, and quick actions.
            </p>
            <Link
                to="/vim/dashboard"
                search={{ tab: 'create' }}
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-neutral-900 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800"
            >
                Create your first creative
                <ArrowRight className="size-4" />
            </Link>
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

function LoadingGrid() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                    key={i}
                    className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
                >
                    <div className="aspect-video w-full animate-pulse bg-neutral-100" />
                    <div className="space-y-2 p-4">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-100" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function formatTimestamp(iso: string): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
