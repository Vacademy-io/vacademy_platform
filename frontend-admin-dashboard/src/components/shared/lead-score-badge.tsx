import { cn } from '@/lib/utils';
import { tierChipStyle, useLeadTiers } from '@/hooks/use-lead-tiers';

/** Tier key — one of the institute's lead_tier catalog keys (HOT/WARM/COLD by default). */
export type LeadTier = string;

interface LeadScoreBadgeProps {
    score: number | null | undefined;
    /**
     * Explicit tier from the backend (UserLeadProfile.lead_tier).
     * When present it wins over the score-derived tier — this is how manual
     * admin overrides surface in the UI. When null/undefined, the tier is
     * inferred from `score` using the institute's tier bands (Hot ≥80 /
     * Warm ≥50 / Cold by default).
     */
    tier?: LeadTier | string | null | undefined;
    /** Show raw score number next to tier label. Default: true */
    showScore?: boolean;
    /** 'sm' for table cells, 'md' for sidebar cards */
    size?: 'sm' | 'md';
    className?: string;
}

export function LeadScoreBadge({
    score,
    tier,
    showScore = true,
    size = 'sm',
    className,
}: LeadScoreBadgeProps) {
    const catalog = useLeadTiers();
    const resolvedKey = catalog.resolve(tier, score);
    if (resolvedKey == null) return null;
    const isSmall = size === 'sm';

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full border font-medium',
                isSmall ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
                className
            )}
            // Inline style: tier colour is admin-picked hex with no design-token equivalent.
            style={tierChipStyle(catalog.colorFor(resolvedKey))}
        >
            {catalog.labelFor(resolvedKey)}
            {showScore && score != null && <span className="opacity-70">· {score}</span>}
        </span>
    );
}
