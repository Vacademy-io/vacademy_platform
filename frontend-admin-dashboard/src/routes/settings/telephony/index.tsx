import { createFileRoute } from '@tanstack/react-router';

// A plain string literal, so the route generator can see this path (an `as any`
// cast here made it skip the file, which is why the tree never had this route).
export const Route = createFileRoute('/settings/telephony/')({});
