import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { FollowUpsPage } from './-components/follow-ups-page';

export const Route = createLazyFileRoute('/audience-manager/follow-ups/')({
    component: FollowUpsRoute,
});

function FollowUpsRoute() {
    return (
        <LayoutContainer>
            <FollowUpsPage />
        </LayoutContainer>
    );
}
