import { Warning, Sun, CalendarBlank, ListChecks } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { FollowUpBucket } from './follow-up-buckets';

/**
 * FollowUpStatTiles — the dominant element of the Follow-ups page.
 *
 * Three large bucket cards (Pending / Today / Upcoming) plus an "All" tile.
 * Counts are derived from the current page of fetched leads (UI-only stand-in
 * for a future global-count endpoint — swap-in is trivial because the page
 * already passes the precomputed counts as props).
 *
 * Each tile is clickable; the active bucket gets a primary-coloured ring.
 */

interface FollowUpStatTilesProps {
    counts: Record<FollowUpBucket, number>;
    active: FollowUpBucket;
    onChange: (bucket: FollowUpBucket) => void;
}

interface TileSpec {
    bucket: FollowUpBucket;
    label: string;
    caption: string;
    Icon: typeof Warning;
    tone: 'danger' | 'warning' | 'info' | 'neutral';
}

const TILES: TileSpec[] = [
    {
        bucket: 'overdue',
        label: 'Pending',
        caption: 'Overdue',
        Icon: Warning,
        tone: 'danger',
    },
    {
        bucket: 'today',
        label: 'Today',
        caption: 'Due today',
        Icon: Sun,
        tone: 'warning',
    },
    {
        bucket: 'upcoming',
        label: 'Upcoming',
        caption: 'Next 7 days',
        Icon: CalendarBlank,
        tone: 'info',
    },
    {
        bucket: 'all',
        label: 'All',
        caption: 'All follow-ups',
        Icon: ListChecks,
        tone: 'neutral',
    },
];

// Token-only tone palette — no raw hex.
const TONE_BG: Record<TileSpec['tone'], string> = {
    danger: 'bg-danger-50',
    warning: 'bg-warning-50',
    info: 'bg-info-50',
    neutral: 'bg-neutral-50',
};
const TONE_ICON: Record<TileSpec['tone'], string> = {
    danger: 'text-danger-500',
    warning: 'text-warning-500',
    info: 'text-info-500',
    neutral: 'text-neutral-500',
};
const TONE_BORDER: Record<TileSpec['tone'], string> = {
    danger: 'border-danger-200',
    warning: 'border-warning-200',
    info: 'border-info-200',
    neutral: 'border-neutral-200',
};

export function FollowUpStatTiles({ counts, active, onChange }: FollowUpStatTilesProps) {
    return (
        <div className="flex flex-wrap gap-3">
            {TILES.map(({ bucket, label, caption, Icon, tone }) => {
                const isActive = active === bucket;
                const count = counts[bucket] ?? 0;
                return (
                    <button
                        key={bucket}
                        type="button"
                        onClick={() => onChange(bucket)}
                        className={cn(
                            'flex min-w-44 flex-1 items-center gap-3 rounded-xl border px-5 py-4 text-left transition-all',
                            TONE_BG[tone],
                            isActive
                                ? 'border-primary-400 ring-2 ring-primary-200'
                                : cn(TONE_BORDER[tone], 'hover:border-neutral-300')
                        )}
                        aria-pressed={isActive}
                    >
                        <Icon weight="fill" className={cn('size-7 shrink-0', TONE_ICON[tone])} />
                        <div className="min-w-0 flex-1">
                            <p className="text-3xl font-semibold leading-none text-neutral-900">
                                {count}
                            </p>
                            <p className="mt-1.5 text-sm font-medium text-neutral-700">{label}</p>
                            <p className="text-xs text-neutral-500">{caption}</p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
