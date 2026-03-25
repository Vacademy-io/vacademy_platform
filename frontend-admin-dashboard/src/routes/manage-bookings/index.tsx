import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/manage-bookings/')({
  // No loader needed for now, handled by client-side hooks in component
});
