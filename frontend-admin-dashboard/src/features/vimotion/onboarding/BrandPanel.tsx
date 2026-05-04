import { Sparkles, Wand2, Clapperboard } from 'lucide-react';

const BENEFITS = [
    {
        icon: Sparkles,
        title: 'AI-first creation',
        body: 'Generate explainer videos, scripts, and visuals from a single prompt.',
    },
    {
        icon: Wand2,
        title: 'Built for creators',
        body: 'Studio-grade tooling without the studio overhead.',
    },
    {
        icon: Clapperboard,
        title: 'Ship in minutes',
        body: 'From idea to published video without leaving Vimotion.',
    },
];

export function BrandPanel() {
    return (
        <div className="relative hidden h-full overflow-hidden border-r border-neutral-200/70 bg-[#FAFAF7] p-12 lg:flex lg:flex-col lg:justify-between">
            {/* very soft decorative warmth — barely visible */}
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary-100/60 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-primary-50/80 blur-3xl" />

            <div className="relative">
                <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
                        <Sparkles className="size-4 text-primary-500" />
                    </div>
                    <span className="text-xl font-semibold tracking-tight text-neutral-900">
                        Vimotion
                    </span>
                </div>

                <h2 className="mt-14 max-w-md text-3xl font-semibold leading-tight tracking-tight text-neutral-900">
                    AI content creation, built for studios and solo creators.
                </h2>
                <p className="mt-4 max-w-md text-base text-neutral-600">
                    Plan, generate, and publish AI-powered video content — all in one place.
                </p>
            </div>

            <ul className="relative space-y-5">
                {BENEFITS.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
                            <Icon className="size-4 text-primary-500" />
                        </div>
                        <div>
                            <p className="font-medium text-neutral-900">{title}</p>
                            <p className="text-sm text-neutral-500">{body}</p>
                        </div>
                    </li>
                ))}
            </ul>

            <p className="relative text-xs text-neutral-400">
                © {new Date().getFullYear()} Vimotion · A Vidyayatan product
            </p>
        </div>
    );
}
