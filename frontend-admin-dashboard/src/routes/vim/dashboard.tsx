import { createFileRoute } from '@tanstack/react-router';
import { Sparkles, Wand2, Clapperboard, ArrowRight } from 'lucide-react';

const NEXT_STEPS = [
    {
        Icon: Wand2,
        title: 'Create your first video',
        body: 'Start from a prompt and let Vimotion draft a script, visuals, and voiceover.',
    },
    {
        Icon: Clapperboard,
        title: 'Set up your studio',
        body: 'Add brand assets, voice presets, and team members.',
    },
];

function VimDashboardPlaceholder() {
    return (
        <div className="min-h-screen w-screen bg-[#FAFAF7]">
            <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
                <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
                        <Sparkles className="size-4 text-primary-500" />
                    </div>
                    <span className="text-xl font-semibold tracking-tight text-neutral-900">
                        Vimotion
                    </span>
                </div>

                <div className="space-y-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700">
                        <span className="size-1.5 rounded-full bg-primary-500" />
                        You&rsquo;re in
                    </span>
                    <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
                        Welcome to Vimotion
                    </h1>
                    <p className="max-w-xl text-base text-neutral-600">
                        Your studio is ready. The full dashboard for AI content creation is coming
                        next — here&rsquo;s a glimpse of what&rsquo;s on the way.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    {NEXT_STEPS.map(({ Icon, title, body }) => (
                        <div
                            key={title}
                            className="group rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-300"
                        >
                            <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-50 ring-1 ring-neutral-200">
                                <Icon className="size-5 text-primary-500" />
                            </div>
                            <p className="mt-4 font-medium text-neutral-900">{title}</p>
                            <p className="mt-1 text-sm text-neutral-500">{body}</p>
                            <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-neutral-400">
                                Coming soon
                                <ArrowRight className="size-3" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export const Route = createFileRoute('/vim/dashboard')({
    component: VimDashboardPlaceholder,
});
