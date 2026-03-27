import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { InboxPage } from './-components/inbox-page';

export const Route = createLazyFileRoute('/communication/inbox/')({
    component: () => (
        <LayoutContainer intrnalMargin={false}>
            <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
                <InboxPage />
            </div>
        </LayoutContainer>
    ),
});
