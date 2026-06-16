import { createFileRoute } from '@tanstack/react-router';

// Route definition only - component is lazy loaded from chat.lazy.tsx
export const Route = createFileRoute('/chat')({
    // Accept ?conversationId= so a chat push deep-link opens the conversation.
    validateSearch: (search: Record<string, unknown>): { conversationId?: string } => ({
        conversationId:
            typeof search.conversationId === 'string' ? search.conversationId : undefined,
    }),
});
