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
        return {
            htmlUrl: String(search.htmlUrl ?? ''),
            audioUrl: search.audioUrl ? String(search.audioUrl) : undefined,
            wordsUrl: search.wordsUrl ? String(search.wordsUrl) : undefined,
            avatarUrl: search.avatarUrl ? String(search.avatarUrl) : undefined,
            apiKey: search.apiKey ? String(search.apiKey) : undefined,
            orientation: String(search.orientation ?? 'landscape'),
            focusTime,
        };
    },
});
