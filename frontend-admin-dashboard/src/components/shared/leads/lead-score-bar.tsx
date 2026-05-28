import { cn } from '@/lib/utils';

/**
 * LeadScoreBar — the Orbitra-style "Lead Score" thin progress bar + percentage.
 *
 * The fill colour is tinted by the score band so the bar doubles as a tier cue
 * (>=80 hot/red, >=50 warm/amber, else cold/blue), matching LeadScoreBadge's
 * thresholds. Renders nothing when there's no score to show.
 */

interface LeadScoreBarProps {
    score?: number | null;
    /** Hide the trailing "NN%" label (e.g. very tight cells). */
    hideValue?: boolean;
    className?: string;
}

const fillColor = (score: number) => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-blue-500';
};

export function LeadScoreBar({ score, hideValue = false, className }: LeadScoreBarProps) {
    if (score == null) return null;
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div className="h-1.5 w-full min-w-12 overflow-hidden rounded-full bg-neutral-100">
                <div
                    className={cn('h-full rounded-full transition-all', fillColor(clamped))}
                    style={{ width: `${clamped}%` }}
                />
            </div>
            {!hideValue && (
                <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-neutral-600">
                    {clamped}%
                </span>
            )}
        </div>
    );
}
