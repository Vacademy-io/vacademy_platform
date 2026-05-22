import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { LeadReportsPage } from './-components/lead-reports-page';

export const Route = createLazyFileRoute('/audience-manager/reports/')({
    component: LeadReportsRoute,
});

function LeadReportsRoute() {
    return (
        <LayoutContainer>
            <LeadReportsPage />
        </LayoutContainer>
    );
}
