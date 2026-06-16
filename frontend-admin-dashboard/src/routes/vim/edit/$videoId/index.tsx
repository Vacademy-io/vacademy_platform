import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/vim/edit/$videoId/')({
    validateSearch: (search: Record<string, unknown>) => {
        // Deep-link target for the pipeline view's "Edit this scene". When set,
        // the editor scrolls/selects the entry whose [inTime, exitTime) range
        // contains this timestamp once the timeline finishes loading. Falls
        // back to no-op when no entry matches (e.g. seeking past the run).
        const focusTimeRaw = search.focusTime ?? search.t;
        const focusTime =
            focusTimeRaw == null
                ? undefined
                : Number.isFinite(Number(focusTimeRaw))
                  ? Number(focusTimeRaw)
                  : undefined;
        // `kind` selects which backend table this timeline lives in + which
        // /frame/* base saveChanges hits: 'reel' → /external/reels/v1/frame/*,
        // 'studio' → /external/studio/v1/builds/{id}/frame/* (id is the build
        // id, passed as $videoId), anything else → AI-gen-video endpoints.
        // Optional so existing /vim/edit callers don't need to pass it.
        const kindRaw = search.kind == null ? undefined : String(search.kind);
        const kind: 'reel' | 'studio' | undefined =
            kindRaw === 'reel' ? 'reel' : kindRaw === 'studio' ? 'studio' : undefined;
        // Studio builds belong to a project — the detail page passes its id so
        // the editor's Back returns to /vim/studio/$projectId instead of the
        // AI-video production view (which can't resolve a build id).
        const projectId = search.projectId ? String(search.projectId) : undefined;
        return {
            htmlUrl: String(search.htmlUrl ?? ''),
            audioUrl: search.audioUrl ? String(search.audioUrl) : undefined,
            wordsUrl: search.wordsUrl ? String(search.wordsUrl) : undefined,
            avatarUrl: search.avatarUrl ? String(search.avatarUrl) : undefined,
            apiKey: search.apiKey ? String(search.apiKey) : undefined,
            orientation: String(search.orientation ?? 'landscape'),
            kind,
            projectId,
            focusTime,
        };
    },
});
