import { cn } from '@/lib/utils';

interface LeadScoreBadgeProps {
    score: number | null | undefined;
    /** Show raw score number next to tier label. Default: true */
    showScore?: boolean;
    /** 'sm' for table cells, 'md' for sidebar cards */
    size?: 'sm' | 'md';
    className?: string;
}

function getTier(score: number): { label: string; bg: string; text: string } {
    if (score >= 80) return { label: 'HOT', bg: 'bg-red-100', text: 'text-red-700' };
    if (score >= 50) return { label: 'WARM', bg: 'bg-amber-100', text: 'text-amber-700' };
    return { label: 'COLD', bg: 'bg-blue-100', text: 'text-blue-700' };
}

export function LeadScoreBadge({
    score,
    showScore = true,
    size = 'sm',
    className,
}: LeadScoreBadgeProps) {
    if (score == null) return null;

    const { label, bg, text } = getTier(score);
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
            {label}
            {showScore && <span className="opacity-70">· {score}</span>}
        </span>
    );
}
