import { createFileRoute } from '@tanstack/react-router';
import { WaitlistPage } from '@/features/vimotion/waitlist/WaitlistPage';

export const Route = createFileRoute('/vim/waitlist')({
    component: WaitlistPage,
});
