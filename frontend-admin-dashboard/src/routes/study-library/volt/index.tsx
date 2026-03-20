import { createFileRoute } from '@tanstack/react-router';
import './styles.css';

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/volt/')({
    // Component is defined in index.lazy.tsx
});
