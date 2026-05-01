import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { RecentLeadsPage } from './-components/recent-leads-page';

export const Route = createLazyFileRoute('/audience-manager/recent-leads/')({
    component: RecentLeadsRoute,
});

function RecentLeadsRoute() {
    return (
        <LayoutContainer>
            <RecentLeadsPage />
        </LayoutContainer>
    );
}
