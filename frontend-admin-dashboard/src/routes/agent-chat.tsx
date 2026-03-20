import { createFileRoute } from '@tanstack/react-router';

// Route definition only - component is lazy loaded from agent-chat.lazy.tsx
export const Route = createFileRoute('/agent-chat')({
    // Component is defined in agent-chat.lazy.tsx
});
