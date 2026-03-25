import { createLazyFileRoute } from '@tanstack/react-router';
import ManageInventoryPage from './-components/manage-inventory-page';

export const Route = createLazyFileRoute('/manage-inventory/')({
    component: ManageInventoryPage,
});
