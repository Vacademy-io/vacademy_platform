/**
 * Public Content Embed Page
 * Renders AI-generated content (video, quiz, storybook, etc.) for embedding
 *
 * URL: /content/{contentId}
 * Query params:
 *   - timeline: URL to the timeline JSON
 *   - audio: URL to the audio file (optional for non-video content)
 *   - words: URL to the words JSON for captions (optional)
 */

import { createLazyFileRoute, useSearch } from '@tanstack/react-router';
import { AIContentPlayer } from '@/components/ai-video-player/AIContentPlayer';

export const Route = createLazyFileRoute('/content/$contentId/')({
    component: ContentEmbedPage,
});

interface ContentSearchParams {
    timeline?: string;
    audio?: string;
    words?: string;
}

function ContentEmbedPage() {
    // contentId is in the URL for routing but not needed in this component
    const searchParams = useSearch({ from: '/content/$contentId/' }) as ContentSearchParams;

    const { timeline, audio, words } = searchParams;

    if (!timeline) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black text-white">
                <div className="text-center">
                    <h1 className="mb-2 text-xl font-semibold">Content Not Found</h1>
                    <p className="text-gray-400">
                        Missing timeline URL. Please check the embed code.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="w-full bg-black"
            style={{
                height: '100dvh',
                overflow: 'hidden',
                position: 'fixed',
                inset: 0,
            }}
        >
            <AIContentPlayer
                timelineUrl={timeline}
                audioUrl={audio}
                wordsUrl={words}
                width={1920}
                height={1080}
                className="size-full"
            />
        </div>
    );
}
