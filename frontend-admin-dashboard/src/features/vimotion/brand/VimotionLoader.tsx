import { useId } from 'react';
import { cn } from '@/lib/utils';

const BAR_HEIGHTS = [164, 128, 96, 64, 44, 28, 16, 28, 44, 64, 96, 128, 164] as const;
const BAR_DELAYS_S = [
    0, 0.06, 0.12, 0.18, 0.24, 0.3, 0.36, 0.3, 0.24, 0.18, 0.12, 0.06, 0,
] as const;

interface VimotionLoaderProps {
    className?: string;
    size?: number | string;
    label?: string;
}

export function VimotionLoader({ className, size = 56, label = 'Loading' }: VimotionLoaderProps) {
    const rawId = useId();
    const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
    const animName = `vim-pulse-${safeId}`;
    const barClass = `vim-pulse-bar-${safeId}`;
    const dim = typeof size === 'number' ? `${size}px` : size;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 200"
            fill="currentColor"
            role="img"
            aria-label={label}
            className={cn('inline-block', className)}
            style={{ width: dim, height: dim }}
        >
            <style>{`
                @keyframes ${animName} {
                    0%, 100% { transform: scaleY(1); }
                    50%      { transform: scaleY(0.55); }
                }
                .${barClass} {
                    transform-box: fill-box;
                    transform-origin: center;
                    animation: ${animName} 1.4s ease-in-out infinite;
                }
            `}</style>
            {BAR_HEIGHTS.map((h, i) => {
                const x = 24 + i * 12;
                const y = (200 - h) / 2;
                return (
                    <rect
                        key={i}
                        x={x}
                        y={y}
                        width={8}
                        height={h}
                        rx={4}
                        className={barClass}
                        style={{ animationDelay: `${BAR_DELAYS_S[i]}s` }}
                    />
                );
            })}
        </svg>
    );
}
