import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { VimotionLogoMark } from '../brand/VimotionLogoMark';

const CLOUD = 'https://res.cloudinary.com/dn9snfizy/video/upload';
const VIDEO_TX = 'f_auto,q_auto';
const POSTER_TX = 'so_0,f_auto,q_auto';

const videoUrl = (id: string) => `${CLOUD}/${VIDEO_TX}/vimotion/${id}.mp4`;
const posterUrl = (id: string) => `${CLOUD}/${POSTER_TX}/vimotion/${id}.jpg`;

type Orientation = 'landscape' | 'portrait';

type Tile = {
    id: string;
    label: string;
    meta: string;
    orientation: Orientation;
};

// Each tile carries its own orientation and is rendered at the matching
// aspect ratio — landscape clips show landscape, portrait clips show
// portrait. No more square cells cropping portrait video.
const HERO_TILE: Tile = {
    id: 'scroll-right',
    label: 'Launch film',
    meta: '45s · landscape',
    orientation: 'landscape',
};

const PORTRAIT_TILES: Tile[] = [
    {
        id: 'scroll-left',
        label: 'Founder talk',
        meta: '120s · portrait',
        orientation: 'portrait',
    },
    {
        id: 'social-cut',
        label: 'Social cut',
        meta: '9s · portrait',
        orientation: 'portrait',
    },
    {
        id: 'showcase-launch',
        label: 'Doc → reel',
        meta: '60s · portrait',
        orientation: 'portrait',
    },
];

const STATS = [
    { value: '10 min', label: 'Brief → finished video' },
    { value: '+34%', label: 'Demo conversion lift' },
    { value: '28', label: 'Lip-synced languages' },
];

type Props = {
    /** Tagline shown above the grid. Defaults to a generic line. */
    tagline?: string;
    className?: string;
};

export function OutputShowcase({
    tagline = 'AI video, on brand, in minutes — not weeks.',
    className,
}: Props) {
    return (
        <aside
            className={cn(
                // Pin the panel to the viewport on desktop so a tall showcase
                // never pushes the right-hand form below the fold. On mobile,
                // it sits as a section below the form (placed via `order` in
                // the parent grid).
                'relative flex flex-col border-neutral-200/70 bg-[#FAFAF7] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r',
                className
            )}
        >
            {/* Soft warm gradient — matches the orange primary without overpowering. */}
            <div className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-primary-100/70 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-primary-50/80 blur-3xl" />

            <div className="relative flex min-h-full flex-col justify-between gap-6 p-6 sm:p-8 xl:p-10">
                <header>
                    {/* Duplicate of the mobile form-top logo strip — hide on mobile. */}
                    <div className="hidden items-center gap-2.5 lg:flex">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
                            <VimotionLogoMark size={20} className="text-neutral-900" />
                        </div>
                        <span className="text-xl font-semibold tracking-tight text-neutral-900">
                            Vimotion
                        </span>
                    </div>

                    <h2 className="max-w-md text-xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-2xl lg:mt-6 xl:mt-8 xl:text-3xl">
                        {tagline}
                    </h2>
                    <p className="mt-2.5 max-w-md text-sm text-neutral-600">
                        Every clip below was briefed, written, voiced and rendered inside Vimotion —
                        no editor, no agency.
                    </p>
                </header>

                <ShowcaseGrid />

                <StatsRow />
            </div>
        </aside>
    );
}

function ShowcaseGrid() {
    return (
        // Cap width so the landscape hero stays in a wide, clearly-landscape
        // proportion — at full panel width on big screens it grows so tall
        // it reads as portrait. Left-aligned so the grid shares the same
        // edge as the header text above.
        <div className="w-full max-w-md space-y-3 xl:max-w-lg xl:space-y-4">
            <ShowcaseTile tile={HERO_TILE} />

            {/* Portrait clips, side-by-side. Each cell sizes to a true 9:16 frame. */}
            <div className="grid grid-cols-3 gap-3 xl:gap-4">
                {PORTRAIT_TILES.map((tile) => (
                    <ShowcaseTile key={tile.id} tile={tile} />
                ))}
            </div>
        </div>
    );
}

function ShowcaseTile({ tile }: { tile: Tile }) {
    const ref = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const node = ref.current;
        const v = videoRef.current;
        if (!node || !v) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) return;
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) v.play().catch(() => {});
                else v.pause();
            },
            { threshold: 0.3 }
        );
        obs.observe(node);
        return () => obs.disconnect();
    }, []);

    const aspect = tile.orientation === 'landscape' ? 'aspect-video' : 'aspect-[9/16]';

    return (
        <div ref={ref} className="space-y-1.5">
            <div
                className={cn(
                    // Soft ring + tasteful shadow instead of a hard border on a
                    // black background — works whether the underlying video is
                    // light or dark.
                    'relative overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(10,13,18,0.04),0_10px_24px_-12px_rgba(10,13,18,0.18)] ring-1 ring-black/[0.06] transition group-hover:ring-black/[0.10]',
                    aspect
                )}
            >
                <video
                    ref={videoRef}
                    src={videoUrl(tile.id)}
                    poster={posterUrl(tile.id)}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-label={tile.label}
                    className="absolute inset-0 size-full object-cover"
                />
            </div>
            <div className="flex items-baseline justify-between px-0.5 text-[11px]">
                <span className="font-medium text-neutral-800">{tile.label}</span>
                <span className="text-neutral-400">{tile.meta}</span>
            </div>
        </div>
    );
}

function StatsRow() {
    return (
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-neutral-200 bg-white/70 p-4 backdrop-blur xl:gap-4 xl:p-5">
            {STATS.map((s) => (
                <div key={s.label}>
                    <div className="text-2xl font-semibold tracking-tight text-neutral-900 xl:text-3xl">
                        {s.value}
                    </div>
                    <div className="mt-1 text-[11px] leading-tight text-neutral-500 xl:text-xs">
                        {s.label}
                    </div>
                </div>
            ))}
        </div>
    );
}
