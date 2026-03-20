import { createLazyFileRoute } from '@tanstack/react-router';
import { RouteComponent } from './index';

// Lazy route wrapper - imports the actual component from index.tsx
// This ensures that changes in index.tsx are used, not a duplicate implementation
export const Route = createLazyFileRoute('/study-library/ai-copilot/course-outline/generating/')({
    component: RouteComponent,
});
