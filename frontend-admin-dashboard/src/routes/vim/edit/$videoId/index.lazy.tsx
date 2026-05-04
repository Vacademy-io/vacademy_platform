import { createLazyFileRoute, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { VideoEditorPage } from '@/components/ai-video-editor/VideoEditorPage';

export const Route = createLazyFileRoute('/vim/edit/$videoId/')({
    component: VimVideoEditorRoute,
});

function VimVideoEditorRoute() {
    const navigate = useNavigate();
    const { videoId } = useParams({ from: '/vim/edit/$videoId/' });
    const { htmlUrl, audioUrl, wordsUrl, avatarUrl, apiKey, orientation, focusTime } = useSearch({
        from: '/vim/edit/$videoId/',
    });

    // Back from the editor returns to the production view of this video so the
    // user stays inside the vim shell. The default behavior in VideoEditorPage
    // navigates to `/video-api-studio`, which would punt them out of vim.
    const handleBack = () => {
        navigate({ to: '/vim/dashboard', search: { videoId } });
    };

    return (
        <VideoEditorPage
            videoId={videoId}
            htmlUrl={htmlUrl}
            audioUrl={audioUrl}
            wordsUrl={wordsUrl}
            avatarUrl={avatarUrl}
            apiKey={apiKey}
            orientation={orientation}
            focusTime={focusTime}
            onBack={handleBack}
        />
    );
}
