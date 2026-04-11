import { createLazyFileRoute, useParams, useSearch } from '@tanstack/react-router';
import { VideoEditorPage } from '@/components/ai-video-editor/VideoEditorPage';

export const Route = createLazyFileRoute('/video-api-studio/edit/$videoId/')({
    component: VideoEditorRoute,
});

function VideoEditorRoute() {
    const { videoId } = useParams({ from: '/video-api-studio/edit/$videoId/' });
    const { htmlUrl, audioUrl, wordsUrl, avatarUrl, apiKey, orientation } = useSearch({
        from: '/video-api-studio/edit/$videoId/',
    });

    return (
        <VideoEditorPage
            videoId={videoId}
            htmlUrl={htmlUrl}
            audioUrl={audioUrl}
            wordsUrl={wordsUrl}
            avatarUrl={avatarUrl}
            apiKey={apiKey}
            orientation={orientation}
        />
    );
}
