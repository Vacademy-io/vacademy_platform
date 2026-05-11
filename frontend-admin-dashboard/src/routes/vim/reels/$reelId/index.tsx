import { createFileRoute } from '@tanstack/react-router';
import { ReelDetailPage } from '@/features/vimotion/reels/detail/ReelDetailPage';

/**
 * `/vim/reels/$reelId` — reel detail + render status page.
 *
 * The page polls `GET /external/reels/v1/{reel_id}` adaptively while the
 * reel is mid-render; renders the final MP4 + "Open in editor" CTA on
 * COMPLETED; surfaces error messages + retry path on FAILED.
 */
export const Route = createFileRoute('/vim/reels/$reelId/')({
    component: RouteComponent,
});

function RouteComponent() {
    const { reelId } = Route.useParams();
    return <ReelDetailPage reelId={reelId} />;
}
