import { Star } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useCounsellorRating } from './useCounsellorRating';

export type CounsellorRatingBadgeSize = 'sm' | 'md' | 'lg';

interface Props {
    instituteId: string | undefined;
    userId: string | undefined;
    size?: CounsellorRatingBadgeSize;
    /** When true (default), shows a skeleton chip while loading; otherwise renders null. */
    showLoading?: boolean;
    /** When true, hides the badge entirely if the counsellor has no sample (cold start). */
    hideOnZero?: boolean;
}

const SIZE: Record<CounsellorRatingBadgeSize, { wrap: string; icon: string; text: string }> = {
    sm: { wrap: 'h-5 px-1.5 gap-1', icon: 'size-3', text: 'text-caption' },
    md: { wrap: 'h-6 px-2 gap-1', icon: 'size-3.5', text: 'text-subtitle' },
    lg: { wrap: 'h-8 px-3 gap-1.5', icon: 'size-4', text: 'text-body' },
};

/**
 * Color band derived from score 0..100 with a clear narrative:
 *   ≥ 75 → success (top performers)
 *   ≥ 50 → info (steady)
 *   ≥ 25 → warning (needs attention)
 *   <  25 → danger (struggling / cold start)
 *
 * Cold-start counsellors (sample_size below threshold) get the same warning
 * band so the UI isn't penalising someone too harshly with a red badge when
 * they haven't been observed enough yet — see backend min_sample_size.
 */
function colorBand(score: number, sampleSize: number | null) {
    if (sampleSize !== null && sampleSize === 0) return 'warning';
    if (score >= 75) return 'success';
    if (score >= 50) return 'info';
    if (score >= 25) return 'warning';
    return 'danger';
}

const BAND_CLASSES: Record<string, string> = {
    success: 'bg-success-50 text-success-700 border-success-200',
    info: 'bg-primary-50 text-primary-700 border-primary-200',
    warning: 'bg-warning-50 text-warning-700 border-warning-200',
    danger: 'bg-danger-50 text-danger-700 border-danger-200',
    neutral: 'bg-neutral-50 text-neutral-600 border-neutral-200',
};

/**
 * Reusable rating badge. Use it wherever a counsellor name appears in a list,
 * dropdown, or card. The component is a thin renderer over the React Query
 * cache (see useCounsellorRating) — opening a dropdown with N counsellors
 * triggers at most N fetches, deduped by query key.
 *
 * For dense lists, call useCounsellorRatingBatch from the parent to warm the
 * cache so each badge resolves synchronously.
 */
export function CounsellorRatingBadge({
    instituteId,
    userId,
    size = 'sm',
    showLoading = true,
    hideOnZero = false,
}: Props) {
    const { data, isLoading } = useCounsellorRating(instituteId, userId);
    const sz = SIZE[size];

    if (isLoading) {
        if (!showLoading) return null;
        return (
            <span
                aria-busy="true"
                className={cn(
                    'inline-flex items-center rounded-full border animate-pulse',
                    BAND_CLASSES.neutral,
                    sz.wrap,
                    sz.text
                )}
            />
        );
    }
    if (!data) return null;
    const score = Number(data.score ?? 0);
    if (hideOnZero && score === 0 && (data.sample_size ?? 0) === 0) return null;

    const band = colorBand(score, data.sample_size);

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border font-medium',
                BAND_CLASSES[band],
                sz.wrap,
                sz.text
            )}
            title={
                data.strategy_type === 'STATIC'
                    ? `Rating ${score.toFixed(0)} (static)`
                    : `Rating ${score.toFixed(0)} · ${data.sample_size ?? 0} leads (90d)`
            }
        >
            <Star weight="fill" className={sz.icon} />
            {score.toFixed(0)}
        </span>
    );
}
