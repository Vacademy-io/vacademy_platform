import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { OffersPage } from './-components/offers-page';

export const Route = createLazyFileRoute('/admin-package-management/offers/')({
    component: () => (
        <LayoutContainer>
            <OffersPage />
        </LayoutContainer>
    ),
});
