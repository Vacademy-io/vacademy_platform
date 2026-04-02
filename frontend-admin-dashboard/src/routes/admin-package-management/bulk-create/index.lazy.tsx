import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { BulkCreatePage } from './-components/bulk-create-page';

export const Route = createLazyFileRoute('/admin-package-management/bulk-create/')({
    component: () => (
        <LayoutContainer>
            <BulkCreatePage />
        </LayoutContainer>
    ),
});
