import { cn } from '@/lib/utils';

export type LeadTier = 'HOT' | 'WARM' | 'COLD';

interface LeadScoreBadgeProps {
    score: number | null | undefined;
    /**
     * Explicit tier from the backend (UserLeadProfile.lead_tier).
     * When present (HOT/WARM/COLD), it wins over score-derived tier — this is how
     * manual admin overrides surface in the UI. When null/undefined, tier is
     * inferred from `score` using the default 80/50/0 thresholds.
     */
    tier?: LeadTier | string | null | undefined;
    /** Show raw score number next to tier label. Default: true */
    showScore?: boolean;
    /** 'sm' for table cells, 'md' for sidebar cards */
    size?: 'sm' | 'md';
    className?: string;
}

const TIER_STYLES: Record<LeadTier, { bg: string; text: string }> = {
    HOT: { bg: 'bg-red-100', text: 'text-red-700' },
    WARM: { bg: 'bg-amber-100', text: 'text-amber-700' },
    COLD: { bg: 'bg-blue-100', text: 'text-blue-700' },
};

function inferTierFromScore(score: number): LeadTier {
    if (score >= 80) return 'HOT';
    if (score >= 50) return 'WARM';
    return 'COLD';
}

function normalizeTier(tier: LeadScoreBadgeProps['tier']): LeadTier | null {
    if (!tier) return null;
    const upper = String(tier).toUpperCase();
    if (upper === 'HOT' || upper === 'WARM' || upper === 'COLD') return upper;
    return null;
}

export function LeadScoreBadge({
    score,
    tier,
    showScore = true,
    size = 'sm',
    className,
}: LeadScoreBadgeProps) {
    const explicitTier = normalizeTier(tier);

    if (explicitTier == null && score == null) return null;

    const resolvedTier: LeadTier = explicitTier ?? inferTierFromScore(score as number);
    const { bg, text } = TIER_STYLES[resolvedTier];
    const isSmall = size === 'sm';

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full font-medium',
                bg,
                text,
                isSmall ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
                className
            )}
        >
            {resolvedTier}
            {showScore && score != null && <span className="opacity-70">· {score}</span>}
        </span>
    );
}
