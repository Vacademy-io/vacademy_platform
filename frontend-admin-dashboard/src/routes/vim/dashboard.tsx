import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '@/features/vimotion/dashboard/DashboardLayout';

export const Route = createFileRoute('/vim/dashboard')({
    component: DashboardLayout,
});
