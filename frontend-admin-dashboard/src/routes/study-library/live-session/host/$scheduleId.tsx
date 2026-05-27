import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import ZoomHostSdkPlayer from './-components/ZoomHostSdkPlayer';

export const Route = createFileRoute('/study-library/live-session/host/$scheduleId')({
    validateSearch: z.object({
        sessionId: z.string().optional(),
    }),
    component: HostLiveSession,
});

/**
 * Host embed route — intentionally NOT wrapped in LayoutContainer so the Zoom
 * SDK has the full viewport. The admin sidebar / header are competing for
 * width with the SDK's video gallery, which made the embed render tiny or
 * off-center; full-page chrome-free is the right shape for a meeting view.
 * A floating "Back" button replaces the layout's nav.
 */
function HostLiveSession() {
    const { scheduleId } = Route.useParams();
    const { sessionId } = Route.useSearch();
    const navigate = useNavigate();

    const handleBack = () => {
        if (sessionId) {
            navigate({ to: '/study-library/live-session/view/$sessionId', params: { sessionId } });
        } else {
            navigate({ to: '/study-library/live-session' });
        }
    };

    return (
        // No z-index on the outer container: Zoom's Component View renders
        // dropdowns (More menu → Participants, Chat, etc.) as portals on
        // document.body; stacking us above them leaves them unclickable.
        // The header is a real flex row (not absolutely positioned) so the
        // player gets its own space and the Zoom toolbar doesn't get covered
        // by our Back pill at 100% browser zoom.
        <div className="fixed inset-0 flex h-screen w-screen flex-col bg-black">
            <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-black/60 px-3 backdrop-blur">
                <button
                    onClick={handleBack}
                    className="group flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-sm transition hover:bg-white"
                >
                    <ArrowLeft className="size-3.5" />
                    Back to Session
                </button>
                <span className="text-xs font-medium text-white/70">
                    You are joining as host
                </span>
            </div>
            <div className="min-h-0 flex-1">
                <ZoomHostSdkPlayer scheduleId={scheduleId} />
            </div>
        </div>
    );
}
