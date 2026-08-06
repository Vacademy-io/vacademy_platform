import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { LeadBoardPage } from './-components/lead-board-page';

export const Route = createLazyFileRoute('/audience-manager/lead-board/')({
    component: LeadBoardRoute,
});

function LeadBoardRoute() {
    return (
        <LayoutContainer>
            <LeadBoardPage />
        </LayoutContainer>
    );
}
