import { cn } from '@/lib/utils';

/**
 * LeadAvatar — a colored circle with the person's initial, used for both the
 * lead and the assigned counsellor ("agent") across the leads redesign. The
 * background colour is deterministically derived from the name so the same
 * person always gets the same swatch (mirrors the Orbitra reference rows).
 */

const SWATCHES = [
    { bg: 'bg-rose-100', text: 'text-rose-700' },
    { bg: 'bg-amber-100', text: 'text-amber-700' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    { bg: 'bg-sky-100', text: 'text-sky-700' },
    { bg: 'bg-violet-100', text: 'text-violet-700' },
    { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
    { bg: 'bg-cyan-100', text: 'text-cyan-700' },
    { bg: 'bg-lime-100', text: 'text-lime-700' },
] as const;

const SIZE_CLASSES = {
    sm: 'size-6 text-xs',
    md: 'size-9 text-sm',
    lg: 'size-11 text-base',
} as const;

const swatchFor = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    return SWATCHES[Math.abs(hash) % SWATCHES.length]!;
};

interface LeadAvatarProps {
    name?: string | null;
    size?: keyof typeof SIZE_CLASSES;
    className?: string;
}

export function LeadAvatar({ name, size = 'md', className }: LeadAvatarProps) {
    const clean = (name ?? '').trim();
    const initial = clean ? clean[0]!.toUpperCase() : '?';
    const { bg, text } = swatchFor(clean || 'lead');
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
                bg,
                text,
                SIZE_CLASSES[size],
                className
            )}
            aria-hidden
        >
            {initial}
        </span>
    );
}
