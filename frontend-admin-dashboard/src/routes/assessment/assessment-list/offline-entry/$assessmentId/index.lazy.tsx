import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { OfflineEntryMainComponent } from './-components/OfflineEntryMainComponent';

export const Route = createLazyFileRoute(
    '/assessment/assessment-list/offline-entry/$assessmentId/'
)({
    component: () => (
        <LayoutContainer>
            <OfflineEntryMainComponent />
        </LayoutContainer>
    ),
});
