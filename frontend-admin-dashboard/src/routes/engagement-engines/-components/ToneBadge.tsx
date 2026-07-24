import { cn } from '@/lib/utils';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const TONE_CLASS: Record<Tone, string> = {
    success: 'bg-success-50 text-success-600 border-success-200',
    warning: 'bg-warning-50 text-warning-600 border-warning-200',
    danger: 'bg-danger-50 text-danger-600 border-danger-200',
    info: 'bg-info-50 text-info-600 border-info-200',
    neutral: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

export function ToneBadge({
    label,
    tone,
    className,
}: {
    label: string;
    tone: Tone;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-caption font-medium',
                TONE_CLASS[tone],
                className
            )}
        >
            {label}
        </span>
    );
}
