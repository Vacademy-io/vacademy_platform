import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import AdmissionDashboard from './-components/AdmissionDashboard';

export const Route = createLazyFileRoute('/admissions/dashboard/')({
    component: () => (
        <LayoutContainer>
            <AdmissionDashboard />
        </LayoutContainer>
    ),
});
