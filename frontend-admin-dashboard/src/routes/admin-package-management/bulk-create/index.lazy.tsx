import { createLazyFileRoute } from '@tanstack/react-router';
import { BulkCreatePage } from './-components/bulk-create-page';

export const Route = createLazyFileRoute('/admin-package-management/bulk-create/')({
    component: BulkCreatePage,
});
