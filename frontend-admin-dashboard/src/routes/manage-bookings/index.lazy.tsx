import { createLazyFileRoute } from '@tanstack/react-router';
import ManageBookingsPage from './-components/manage-bookings-page';

export const Route = createLazyFileRoute('/manage-bookings/')({
  component: ManageBookingsPage,
});
