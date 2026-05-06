import { useEffect, useState } from 'react';
import { createLazyFileRoute, useParams, useSearch } from '@tanstack/react-router';
import { VideoEditorPage } from '@/components/ai-video-editor/VideoEditorPage';

export const Route = createLazyFileRoute('/video-api-studio/edit/$videoId/')({
    component: VideoEditorRoute,
});

const API_KEY_STORAGE_KEY = 'vx-api-key';

/**
 * Read `apiKey` from the URL exactly once, mirror it into sessionStorage,
 * and immediately strip it from the visible URL via `history.replaceState`.
 * Fall back to a previously-stored sessionStorage value when the URL has
 * no `apiKey` (e.g. user reloaded after we stripped it, or navigated here
 * from elsewhere in the SPA).
 *
 * Why this matters: `apiKey` in the query string ends up in browser history,
 * the `Referer` header, server access logs, and is copied verbatim if the
 * user shares the URL. sessionStorage is tab-scoped and isn't transmitted.
 */
function useStashedApiKey(initial: string | undefined): string | undefined {
    const [apiKey, setApiKey] = useState<string | undefined>(initial);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const fromUrl = new URL(window.location.href).searchParams.get('apiKey');
        if (fromUrl) {
            try {
                sessionStorage.setItem(API_KEY_STORAGE_KEY, fromUrl);
            } catch {
                /* storage may be disabled (private mode); fine — apiKey lives
                 * in the React tree for this session anyway. */
            }
            try {
                const cleaned = new URL(window.location.href);
                cleaned.searchParams.delete('apiKey');
                window.history.replaceState(
                    window.history.state,
                    '',
                    cleaned.pathname + cleaned.search + cleaned.hash
                );
            } catch {
                /* replaceState can fail in cross-origin sandboxes; safe to ignore */
            }
            setApiKey(fromUrl);
            return;
        }
        try {
            const stored = sessionStorage.getItem(API_KEY_STORAGE_KEY);
            if (stored) setApiKey(stored);
        } catch {
            /* ignore */
        }
        // Run once per mount; we intentionally don't react to `initial` changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return apiKey;
}

function VideoEditorRoute() {
    const { videoId } = useParams({ from: '/video-api-studio/edit/$videoId/' });
    const { htmlUrl, audioUrl, wordsUrl, avatarUrl, apiKey, orientation, focusTime } = useSearch({
        from: '/video-api-studio/edit/$videoId/',
    });

    const safeApiKey = useStashedApiKey(apiKey);

    return (
        <VideoEditorPage
            videoId={videoId}
            htmlUrl={htmlUrl}
            audioUrl={audioUrl}
            wordsUrl={wordsUrl}
            avatarUrl={avatarUrl}
            apiKey={safeApiKey}
            orientation={orientation}
            focusTime={focusTime}
        />
    );
}
