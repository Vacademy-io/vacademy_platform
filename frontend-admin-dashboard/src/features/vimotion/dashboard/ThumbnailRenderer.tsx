import { cn } from '@/lib/utils';
import type { ThumbnailOption } from '@/routes/video-api-studio/-services/video-generation';
import type { BrandKit } from '@/features/vimotion/api/dashboardTypes';

type RendererSize = 'sm' | 'md' | 'lg';

interface ThumbnailRendererProps {
    thumb: ThumbnailOption;
    brandKit?: BrandKit | null;
    /** Visual size — drives font scale + padding. Defaults to 'md'. */
    size?: RendererSize;
    /** Container aspect override. Defaults to 16:9 (landscape). */
    orientation?: 'landscape' | 'portrait';
    className?: string;
}

const HEADLINE_FONT_SCALE: Record<RendererSize, string> = {
    sm: 'text-sm leading-tight',
    md: 'text-xl leading-tight',
    lg: 'text-3xl leading-tight',
};

const PAD_SCALE: Record<RendererSize, string> = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-5',
};

/**
 * Renders a thumbnail base image.
 *
 * - `layout: 'baked'` — the image already contains the headline typography
 *   rendered by Recraft. We render just the `<img>` with no overlay; the
 *   brand kit is irrelevant.
 * - Legacy layouts (`bottom_band` / `top_left` / `center` / `none`) — the
 *   image is a Seedream-era plain photograph and we composite the headline
 *   on top using the brand kit's font + palette. Kept for backward compat
 *   with thumbnails that pre-date the Recraft migration.
 */
export function ThumbnailRenderer({
    thumb,
    brandKit,
    size = 'md',
    orientation = 'landscape',
    className,
}: ThumbnailRendererProps) {
    const aspectClass = orientation === 'portrait' ? 'aspect-[9/16]' : 'aspect-video';

    // Baked-in text path — just render the image. No overlay, no brand kit needed.
    if (thumb.layout === 'baked') {
        return (
            <div
                className={cn(
                    'relative w-full overflow-hidden bg-neutral-900',
                    aspectClass,
                    className
                )}
            >
                <img
                    src={thumb.image_url}
                    alt={(thumb.headline || '').trim() || 'Thumbnail'}
                    className="absolute inset-0 size-full object-cover"
                    loading="lazy"
                />
            </div>
        );
    }

    // Legacy overlay path (kept for thumbnails written before the Recraft swap).
    const headingFont = brandKit?.heading_font;
    const headlineColor =
        brandKit?.palette?.primary || brandKit?.palette?.accent || '#ffffff';
    const bandColor = brandKit?.palette?.background || '#0a0a0a';
    const headline = (thumb.headline || '').trim();

    return (
        <div
            className={cn(
                'relative w-full overflow-hidden bg-neutral-900',
                aspectClass,
                className
            )}
        >
            <img
                src={thumb.image_url}
                alt={headline || 'Thumbnail'}
                className="absolute inset-0 size-full object-cover"
                loading="lazy"
            />

            {headline && thumb.layout !== 'none' && (
                <HeadlineOverlay
                    layout={thumb.layout}
                    headline={headline}
                    color={headlineColor}
                    bandColor={bandColor}
                    fontFamily={headingFont}
                    size={size}
                />
            )}

            {/* Legacy type_led ('none' layout) — the headline IS the thumbnail. */}
            {headline && thumb.layout === 'none' && (
                <div
                    className={cn(
                        'absolute inset-0 flex items-center justify-center text-center',
                        PAD_SCALE[size]
                    )}
                >
                    <div
                        className={cn(
                            'font-extrabold uppercase tracking-tight',
                            size === 'lg'
                                ? 'text-5xl leading-none'
                                : size === 'md'
                                ? 'text-3xl leading-none'
                                : 'text-lg leading-none'
                        )}
                        style={{
                            color: headlineColor,
                            fontFamily: headingFont,
                            textShadow: '0 2px 14px rgba(0,0,0,0.45)',
                        }}
                    >
                        {headline}
                    </div>
                </div>
            )}
        </div>
    );
}

function HeadlineOverlay({
    layout,
    headline,
    color,
    bandColor,
    fontFamily,
    size,
}: {
    layout: string;
    headline: string;
    color: string;
    bandColor: string;
    fontFamily?: string;
    size: RendererSize;
}) {
    if (layout === 'bottom_band') {
        return (
            <div className="pointer-events-none absolute inset-x-0 bottom-0">
                <div
                    className={cn('text-balance font-bold', PAD_SCALE[size], HEADLINE_FONT_SCALE[size])}
                    style={{
                        background: `linear-gradient(to top, ${withAlpha(bandColor, 0.92)} 25%, transparent)`,
                        color,
                        fontFamily,
                    }}
                >
                    {headline}
                </div>
            </div>
        );
    }

    if (layout === 'top_left') {
        return (
            <div className="pointer-events-none absolute inset-0">
                <div
                    className={cn('inline-block max-w-[70%] font-bold', PAD_SCALE[size], HEADLINE_FONT_SCALE[size])}
                    style={{
                        color,
                        fontFamily,
                        textShadow: '0 2px 10px rgba(0,0,0,0.55)',
                    }}
                >
                    {headline}
                </div>
            </div>
        );
    }

    if (layout === 'center') {
        return (
            <div
                className={cn(
                    'pointer-events-none absolute inset-0 flex items-center justify-center text-center',
                    PAD_SCALE[size]
                )}
            >
                <div
                    className={cn('text-balance font-extrabold', HEADLINE_FONT_SCALE[size])}
                    style={{
                        color,
                        fontFamily,
                        textShadow: '0 2px 14px rgba(0,0,0,0.55)',
                    }}
                >
                    {headline}
                </div>
            </div>
        );
    }

    return null;
}

/** Convert a #rrggbb to rgba() with the given alpha. Falls back to the hex
 *  when parsing fails. */
function withAlpha(hex: string, alpha: number): string {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
    if (!m) return hex;
    const v = m[1];
    if (!v) return hex;
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
