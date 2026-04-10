import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/video-api-studio/edit/$videoId/')({
    validateSearch: (search: Record<string, unknown>) => ({
        htmlUrl: String(search.htmlUrl ?? ''),
        audioUrl: search.audioUrl ? String(search.audioUrl) : undefined,
        wordsUrl: search.wordsUrl ? String(search.wordsUrl) : undefined,
        avatarUrl: search.avatarUrl ? String(search.avatarUrl) : undefined,
        apiKey: search.apiKey ? String(search.apiKey) : undefined,
        orientation: String(search.orientation ?? 'landscape'),
    }),
});
