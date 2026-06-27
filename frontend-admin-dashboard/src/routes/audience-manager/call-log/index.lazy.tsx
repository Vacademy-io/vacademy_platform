import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { CallLogPage } from './-components/call-log-page';

export const Route = createLazyFileRoute('/audience-manager/call-log/')({
    component: CallLogRoute,
});

function CallLogRoute() {
    return (
        <LayoutContainer>
            <CallLogPage />
        </LayoutContainer>
    );
}
