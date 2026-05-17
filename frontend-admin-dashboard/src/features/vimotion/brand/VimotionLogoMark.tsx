import { cn } from '@/lib/utils';

const BAR_HEIGHTS = [164, 128, 96, 64, 44, 28, 16, 28, 44, 64, 96, 128, 164] as const;

interface VimotionLogoMarkProps {
    className?: string;
    size?: number | string;
    variant?: 'slim' | 'block';
}

export function VimotionLogoMark({ className, size, variant = 'slim' }: VimotionLogoMarkProps) {
    const isBlock = variant === 'block';
    const barWidth = isBlock ? 8 : 1.4;
    const step = isBlock ? 12 : 2.2;
    const totalWidth = barWidth + step * (BAR_HEIGHTS.length - 1);
    const startX = isBlock ? 24 : (200 - totalWidth) / 2;
    const rx = barWidth / 2;
    const dim = typeof size === 'number' ? `${size}px` : size;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 200"
            fill="currentColor"
            aria-hidden="true"
            className={cn('inline-block', className)}
            style={dim ? { width: dim, height: dim } : undefined}
        >
            {BAR_HEIGHTS.map((h, i) => {
                const x = startX + i * step;
                const y = (200 - h) / 2;
                return <rect key={i} x={x} y={y} width={barWidth} height={h} rx={rx} />;
            })}
        </svg>
    );
}
