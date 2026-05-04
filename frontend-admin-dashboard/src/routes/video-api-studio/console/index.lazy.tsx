import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { VideoConsoleWorkspace } from '../-components/VideoConsoleWorkspace';

export const Route = createLazyFileRoute('/video-api-studio/console/')({
    component: VideoConsole,
});

function VideoConsole() {
    return (
        <LayoutContainer intrnalMargin={false} hasInternalSidebarComponent={true}>
            <div className="h-[calc(100vh-56px)] md:h-[calc(100vh-72px)]">
                <VideoConsoleWorkspace />
            </div>
        </LayoutContainer>
    );
}
