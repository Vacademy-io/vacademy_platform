import { cn } from '@/lib/utils';

interface DuplicateBadgeProps {
    isDuplicate: boolean | null | undefined;
    className?: string;
}

export function DuplicateBadge({ isDuplicate, className }: DuplicateBadgeProps) {
    if (!isDuplicate) return null;

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600',
                className
            )}
        >
            Duplicate
        </span>
    );
}
