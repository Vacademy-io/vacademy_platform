import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clapperboard,
    Clock,
    Copy,
    PlayCircle,
    RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { VimotionLoader } from '../brand/VimotionLoader';
import { getInstituteId } from '@/constants/helper';
import {
    getRemoteHistory,
    REUSE_SETTINGS_HANDOFF_KEY,
    buildReuseSettingsPayload,
    type HistoryItem,
} from '@/routes/video-api-studio/-services/video-generation';
import { cn } from '@/lib/utils';
import { useVimotionApiKey } from './hooks/useVimotionApiKey';
import { getDefaultBrandKit } from '@/features/vimotion/api/brandKits';
import type { BrandKit } from '@/features/vimotion/api/dashboardTypes';
import { ThumbnailRenderer } from './ThumbnailRenderer';

const PAGE_SIZE = 20;

// Lazily-captured original title. Set by the first flash that fires,
// cleared by the first restore. We can't capture at module load because
// `useVimotionDocumentChrome` (in DashboardLayout) sets the title to
// "Vimotion" via a useEffect that runs AFTER this module is imported —
// so a module-time capture would snapshot the bootloader title from
// index.html ("Vacademy Admin"), and restoring would clobber the
// Vimotion-set title.
let flashOriginalTitle: string | null = null;

/**
 * Update the tab title to alert a user who's currently on another tab/window.
 * Auto-restores on tab focus or after 30 s — whichever first.
 *
 * Safe under stacking (multiple flashes in quick succession) and under
 * external title changes (e.g. route nav that runs `useVimotionDocumentChrome`'s
 * cleanup): the first flash captures the real title, subsequent flashes reuse
 * it, and the restore only fires when the current title still looks like one
 * of our flashes — otherwise we leave whatever external code set in place.
 */
function flashTabTitle(text: string) {
    if (typeof document === 'undefined') return;
    if (flashOriginalTitle === null) {
        flashOriginalTitle = document.title;
    }
    document.title = text;
    const restore = () => {
        const current = document.title;
        const isStillAFlash = current.startsWith('✅') || current.startsWith('⚠️');
        if (isStillAFlash && flashOriginalTitle !== null) {
            document.title = flashOriginalTitle;
        }
        flashOriginalTitle = null;
        window.removeEventListener('focus', restore);
    };
    window.addEventListener('focus', restore);
    window.setTimeout(restore, 30_000);
}

/**
 * Fire the three-stack notification when a video transitions to a terminal
 * status (completed | failed):
 *   1. `document.title` flash — wakes the user when on another tab
 *   2. Browser Notification — only when the user has already granted
 *      permission. We never prompt — that's a dark pattern in this context.
 *   3. In-app `toast` — visible when the dashboard tab IS focused.
 */
function fireCompletionNotification(item: HistoryItem) {
    const success = item.status === 'completed';
    const label = (item.prompt || '').trim().slice(0, 80) || 'Untitled video';

    flashTabTitle(`${success ? '✅' : '⚠️'} Video ${success ? 'ready' : 'failed'}`);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
            // eslint-disable-next-line no-new -- the browser owns lifecycle once created
            new Notification(success ? 'Vimotion: video ready' : 'Vimotion: generation failed', {
                body: label,
                // Vimotion-branded icon (matches what useVimotionDocumentChrome
                // wires up for the tab favicon). SVG support in Notification
                // icons is browser-dependent; failure falls back to the OS
                // default icon — purely cosmetic, no functional impact.
                icon: '/vimotion-favicon.svg',
                tag: `vimotion-${item.id}`, // dedupe if effect re-fires
            });
        } catch {
            // Some browsers throw on insecure contexts / unsupported configs.
            // Failure here is non-critical — the toast still fires below.
        }
    }

    const toastFn = success ? toast.success : toast.error;
    toastFn(success ? 'Video ready' : 'Generation failed', { description: label });
}

export function RecentTab() {
    const instituteId = getInstituteId();
    const apiKey = useVimotionApiKey(instituteId);

    const history = useInfiniteQuery({
        queryKey: ['vimotion-history', instituteId, apiKey.data],
        queryFn: ({ pageParam }) => getRemoteHistory(apiKey.data!, PAGE_SIZE, pageParam),
        initialPageParam: 0,
        // The backend returns a bare list (no total count), so "there's more"
        // is inferred from a full page. A page shorter than PAGE_SIZE means
        // we've hit the end.
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
        enabled: !!apiKey.data,
        staleTime: 30_000,
        // Thumbnails arrive ~mid-render in a background job. Keep polling
        // while anything is still generating; once completed/failed the row
        // state is final (a completed video with no thumbnails means the
        // batch failed — no amount of polling will fill it in).
        refetchInterval: (q) => {
            const pages = q.state.data?.pages ?? [];
            const anyInFlight = pages
                .flat()
                .some((it) => it.status !== 'completed' && it.status !== 'failed');
            return anyInFlight ? 10_000 : false;
        },
    });

    // Flatten pages, deduping by id: offset pagination shifts when a new
    // video lands between fetches, so an item can appear at the end of one
    // page and the start of the next — which would crash React's keyed list.
    const items = useMemo(() => {
        const seen = new Set<string>();
        const flat: HistoryItem[] = [];
        for (const page of history.data?.pages ?? []) {
            for (const item of page) {
                if (seen.has(item.id)) continue;
                seen.add(item.id);
                flat.push(item);
            }
        }
        return flat;
    }, [history.data]);

    // Shared key with OnboardingBanner — react-query dedupes the network call.
    const brandKitQuery = useQuery<BrandKit | null>({
        queryKey: ['vimotion-default-brand-kit', instituteId],
        queryFn: () => getDefaultBrandKit(instituteId ?? ''),
        enabled: !!instituteId,
        staleTime: 60_000,
    });
    const brandKit = brandKitQuery.data ?? null;

    // Detect in-flight → terminal transitions across polling cycles and fire
    // a 3-stack notification (title flash + browser Notification + toast).
    //
    // Caveat: if the user navigates away from Recent mid-generation, this ref
    // resets on remount and we'll miss the transition for that one video.
    // Acceptable trade-off — the user will see the green badge when they
    // return. Persisting across mounts would need sessionStorage and isn't
    // worth the complexity for this edge case.
    const prevStatusesRef = useRef<Map<string, HistoryItem['status']>>(new Map());
    useEffect(() => {
        if (items.length === 0) return;
        const prev = prevStatusesRef.current;
        const next = new Map(items.map((it) => [it.id, it.status]));
        if (prev.size > 0) {
            for (const item of items) {
                const prevStatus = prev.get(item.id);
                if (!prevStatus) continue; // brand-new item, not a transition
                const wasInFlight = prevStatus !== 'completed' && prevStatus !== 'failed';
                const isNowTerminal = item.status === 'completed' || item.status === 'failed';
                if (wasInFlight && isNowTerminal) {
                    fireCompletionNotification(item);
                }
            }
        }
        prevStatusesRef.current = next;
    }, [items]);

    if (apiKey.isError) {
        return (
            <ErrorState
                message="Could not connect to the video service."
                onRetry={() => apiKey.refetch()}
                isRetrying={apiKey.isFetching}
            />
        );
    }

    if (apiKey.isLoading || history.isLoading) {
        return <LoadingGrid />;
    }

    if (history.isError) {
        return (
            <ErrorState
                message="Could not load your recent videos."
                onRetry={() => history.refetch()}
                isRetrying={history.isFetching}
            />
        );
    }

    if (items.length === 0) {
        return <EmptyState />;
    }

    return (
        <div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                    <HistoryCard key={item.id} item={item} brandKit={brandKit} />
                ))}
            </div>
            {history.hasNextPage && (
                <div className="mt-6 flex justify-center">
                    <button
                        type="button"
                        onClick={() => history.fetchNextPage()}
                        disabled={history.isFetchingNextPage}
                        className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw
                            className={cn('size-4', history.isFetchingNextPage && 'animate-spin')}
                        />
                        {history.isFetchingNextPage ? 'Loading…' : 'Load older videos'}
                    </button>
                </div>
            )}
        </div>
    );
}

function HistoryCard({ item, brandKit }: { item: HistoryItem; brandKit: BrandKit | null }) {
    // Any video with a video_id is openable — the dashboard route renders
    // `<VideoConsoleWorkspace initialVideoId={videoId}>` which handles every
    // status: completed → final-cut player, generating/pending → live
    // PipelineLayout polling /status, failed → halted banner with Retry.
    // Only the play-button hover overlay is gated to `completed` since
    // that's specifically a "play video" cue.
    const navigate = useNavigate();
    const canOpen = !!item.video_id;
    const isFailed = item.status === 'failed';
    const isPlayable = item.status === 'completed' && !!item.html_url;
    const ts = formatTimestamp(item.created_at);
    const title = (item.prompt || '').trim() || 'Untitled video';

    const cardClasses = cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-white transition-colors',
        isFailed
            ? 'border-red-200'
            : canOpen
              ? 'border-neutral-200 hover:border-neutral-300'
              : 'border-neutral-200 cursor-default'
    );

    // Pick the selected thumbnail (or fall back to the first option if the
    // selected_id has drifted somehow).
    const thumbs = item.thumbnails;
    const selectedThumb =
        thumbs?.options.find((o) => o.id === thumbs.selected_id) || thumbs?.options[0] || null;
    const orientation =
        (thumbs?.orientation as 'landscape' | 'portrait' | undefined) ?? 'landscape';

    const inner = (
        <>
            <div className="relative w-full bg-neutral-100">
                {selectedThumb ? (
                    <ThumbnailRenderer
                        thumb={selectedThumb}
                        brandKit={brandKit}
                        size="sm"
                        orientation={orientation}
                    />
                ) : (
                    <div className="flex aspect-video size-full items-center justify-center text-neutral-400">
                        <Clapperboard className="size-8" />
                    </div>
                )}
                {isPlayable && (
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

    // Failed cards get a dedicated Retry footer. The whole card is still a
    // link to the production view (where the canonical Retry banner sits) —
    // the footer just makes the next-action visible from the grid, so users
    // don't blow fresh credits re-prompting from scratch.
    const failedFooter = isFailed && canOpen && (
        <div className="border-t border-red-100 bg-red-50 px-3 py-2">
            <button
                type="button"
                onClick={() =>
                    navigate({
                        to: '/vim/dashboard',
                        search: { videoId: item.video_id },
                    })
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 transition-colors hover:bg-red-100"
            >
                <RefreshCw className="size-3.5" />
                Retry generation
            </button>
        </div>
    );

    // Reuse-settings overlay — sibling of the Link (not nested), absolutely
    // positioned so it doesn't add vertical space to the card. Hover-revealed.
    // Only on completed cards: failed cards already have the dedicated Retry
    // affordance below, and in-flight states have no settings yet to reuse.
    const handleReuse = () => {
        try {
            const payload = buildReuseSettingsPayload(item.prompt || '', item.options);
            sessionStorage.setItem(REUSE_SETTINGS_HANDOFF_KEY, JSON.stringify(payload));
            navigate({ to: '/vim/dashboard', search: { tab: 'create' } });
        } catch (err) {
            console.error('Failed to stage reuse-settings handoff', err);
            toast.error('Could not copy settings — please try again.');
        }
    };
    const reuseOverlay = item.status === 'completed' && canOpen && (
        <button
            type="button"
            onClick={handleReuse}
            title="Use these settings for a new video"
            className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[10px] font-medium text-neutral-700 opacity-0 shadow-sm ring-1 ring-neutral-200 backdrop-blur-sm transition-opacity hover:text-neutral-900 hover:ring-neutral-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 group-hover:opacity-100"
        >
            <Copy className="size-3" />
            Reuse settings
        </button>
    );

    if (!canOpen) {
        return <div className={cardClasses}>{inner}</div>;
    }

    return (
        <div className={cardClasses}>
            <Link
                to="/vim/dashboard"
                search={{ videoId: item.video_id }}
                className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
            >
                {inner}
            </Link>
            {reuseOverlay}
            {failedFooter}
        </div>
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
            Icon: CheckCircle2,
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
            {status === 'generating' ? (
                <VimotionLoader size={12} className="text-blue-700" label="Generating" />
            ) : (
                <Icon className="size-3" />
            )}
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

function ErrorState({
    message,
    onRetry,
    isRetrying,
}: {
    message: string;
    onRetry?: () => void;
    isRetrying?: boolean;
}) {
    return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="size-4" />
                    {message}
                </div>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        disabled={isRetrying}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw className={cn('size-3.5', isRetrying && 'animate-spin')} />
                        {isRetrying ? 'Reconnecting…' : 'Try again'}
                    </button>
                )}
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
