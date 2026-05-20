import { useEffect, useState } from 'react';
import { createLazyFileRoute, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Monitor } from 'lucide-react';
import { VideoEditorPage } from '@/components/ai-video-editor/VideoEditorPage';
import { useVideoEditorStore } from '@/components/ai-video-editor/stores/video-editor-store';
import { getInstituteId } from '@/constants/helper';
import { VimTourProvider, useVimTour } from '@/features/vimotion/tour/VimTourProvider';
import { useVimotionDocumentChrome } from '@/features/vimotion/brand/useVimotionDocumentChrome';
import { useVimotionNativeShell } from '@/features/vimotion/native/useVimotionNativeShell';
import { VimotionLogoMark } from '@/features/vimotion/brand/VimotionLogoMark';

export const Route = createLazyFileRoute('/vim/edit/$videoId/')({
    component: VimVideoEditorRoute,
});

// Editor is desktop-only: canvas handles, timeline trim, and Monaco HTML editing
// all require precise pointer input that doesn't translate to touch. The mobile
// app will ship a redesigned editor; for now, gate the route and send users back
// to the production view where they can preview and download renders.
function useIsNarrowViewport(breakpointPx = 768) {
    const [narrow, setNarrow] = useState(() =>
        typeof window === 'undefined'
            ? false
            : window.matchMedia(`(max-width: ${breakpointPx - 1}px)`).matches
    );
    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
        const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [breakpointPx]);
    return narrow;
}

function VimVideoEditorRoute() {
    useVimotionDocumentChrome();
    // Mounted at the route level (not inside VimVideoEditorShell) so the native
    // splash also hides on EditorMobileGate — otherwise a cold-start deep link
    // into the editor on a mobile viewport would leave the splash forever.
    useVimotionNativeShell();
    const instituteId = getInstituteId();
    const isNarrow = useIsNarrowViewport();
    if (isNarrow) {
        return <EditorMobileGate />;
    }
    return (
        <VimTourProvider instituteId={instituteId}>
            <VimVideoEditorShell />
        </VimTourProvider>
    );
}

function EditorMobileGate() {
    const navigate = useNavigate();
    const { videoId } = useParams({ from: '/vim/edit/$videoId/' });
    return (
        <div className="pt-safe pb-safe flex min-h-screen flex-col items-center justify-center bg-[#FAFAF7] px-6 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-neutral-200">
                <VimotionLogoMark size={24} className="text-neutral-900" />
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                <Monitor className="size-3.5" />
                Desktop only
            </div>
            <h1 className="mt-3 text-lg font-semibold text-neutral-900">
                Open on a larger screen to edit
            </h1>
            <p className="mt-2 max-w-xs text-sm text-neutral-600">
                The video editor needs more room than a phone can offer. Open this link on a desktop
                to trim shots, swap layers, and re-narrate scenes.
            </p>
            <button
                type="button"
                onClick={() => navigate({ to: '/vim/dashboard', search: { videoId } })}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-md bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
                Back to video
            </button>
        </div>
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
