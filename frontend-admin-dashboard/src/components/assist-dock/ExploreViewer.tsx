import { Compass, X } from '@phosphor-icons/react';

/**
 * Full-screen feature-catalog viewer ("Explore"). Plays the self-contained catalog page shipped
 * with the app at /vacademy-features.html (source of truth: vacademy_platform/docs/features/ —
 * copy the regenerated file into public/ to update). Loaded by URL, not srcDoc, so the browser
 * caches the ~700KB document; the sandbox (no allow-same-origin) keeps its scripts away from the
 * parent app's DOM/session — same posture as RoadmapViewer/TutorialViewer.
 */
export function ExploreViewer({ open, onClose }: { open: boolean; onClose: () => void }) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex justify-center bg-black/60 p-4 sm:p-10"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="flex size-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Compass size={18} className="text-primary-500" />
                        <p className="text-subtitle font-semibold text-neutral-800">
                            Explore Vacademy
                        </p>
                    </div>
                    <button
                        type="button"
                        aria-label="Close explore"
                        onClick={onClose}
                        className="flex size-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="relative flex-1 bg-neutral-50">
                    <iframe
                        title="Vacademy feature catalog"
                        src="/vacademy-features.html"
                        className="size-full border-0"
                        sandbox="allow-scripts allow-popups"
                    />
                </div>
            </div>
        </div>
    );
}
