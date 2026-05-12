import { useEffect } from 'react';
import { createLazyFileRoute, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { VideoEditorPage } from '@/components/ai-video-editor/VideoEditorPage';
import { useVideoEditorStore } from '@/components/ai-video-editor/stores/video-editor-store';
import { getInstituteId } from '@/constants/helper';
import { VimTourProvider, useVimTour } from '@/features/vimotion/tour/VimTourProvider';

export const Route = createLazyFileRoute('/vim/edit/$videoId/')({
    component: VimVideoEditorRoute,
});

function VimVideoEditorRoute() {
    const instituteId = getInstituteId();
    return (
        <VimTourProvider instituteId={instituteId}>
            <VimVideoEditorShell />
        </VimTourProvider>
    );
}

function VimVideoEditorShell() {
    const navigate = useNavigate();
    const { videoId } = useParams({ from: '/vim/edit/$videoId/' });
    const { htmlUrl, audioUrl, wordsUrl, avatarUrl, apiKey, orientation, kind, focusTime } =
        useSearch({
            from: '/vim/edit/$videoId/',
        });
    const { startTourIfNew } = useVimTour();

    // Back from the editor returns to the production view of this video so the
    // user stays inside the vim shell. The default behavior in VideoEditorPage
    // navigates to `/video-api-studio`, which would punt them out of vim.
    const handleBack = () => {
        navigate({ to: '/vim/dashboard', search: { videoId } });
    };

    // First-time auto-start for the editor tour. Two things must be true
    // before we fire: the store's entries have loaded (so the canvas isn't
    // empty), and at least one entry is selected — the Remake / Properties
    // tabs anchors live inside the per-entry panel and only mount with a
    // selection. Polling the store via getState in a short interval is
    // cleaner than subscribing here, since we only need a one-shot start.
    useEffect(() => {
        let cancelled = false;
        const tryStart = () => {
            if (cancelled) return;
            const state = useVideoEditorStore.getState();
            const first = state.entries[0];
            if (!first) return;
            if (!state.selectedEntryId) {
                state.selectEntry(first.id);
            }
            // Defer one tick after selection so PropertiesPanel mounts the
            // entry-scoped header before the tour measures anchors.
            window.setTimeout(() => {
                if (!cancelled) startTourIfNew('vim-editor');
            }, 200);
        };
        // Poll briefly for entry load — typical load is <1s, give it 8s.
        const start = Date.now();
        const id = window.setInterval(() => {
            if (cancelled || Date.now() - start > 8000) {
                window.clearInterval(id);
                return;
            }
            const state = useVideoEditorStore.getState();
            if (state.entries.length > 0) {
                window.clearInterval(id);
                tryStart();
            }
        }, 250);
        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, [startTourIfNew]);

    return (
        <VideoEditorPage
            videoId={videoId}
            htmlUrl={htmlUrl}
            audioUrl={audioUrl}
            wordsUrl={wordsUrl}
            avatarUrl={avatarUrl}
            apiKey={apiKey}
            orientation={orientation}
            kind={kind}
            focusTime={focusTime}
            onBack={handleBack}
        />
    );
}
