import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import ManageInventoryPage from './-components/manage-inventory-page';

export const Route = createLazyFileRoute('/manage-inventory/')({
    component: () => (
        <LayoutContainer>
            <ManageInventoryPage />
        </LayoutContainer>
    ),
});
