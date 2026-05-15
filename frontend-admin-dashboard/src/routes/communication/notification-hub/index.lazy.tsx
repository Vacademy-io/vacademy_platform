import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { NotificationHubPage } from './-components/notification-hub-page';

export const Route = createLazyFileRoute('/communication/notification-hub/')({
    component: () => (
        <LayoutContainer intrnalMargin={false}>
            <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
                <NotificationHubPage />
            </div>
        </LayoutContainer>
    ),
});
