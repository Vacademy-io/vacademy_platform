import { createFileRoute } from '@tanstack/react-router';
import { PaymentDialogUITest } from '@/components/payment-dialogs/PaymentDialogUITest';

export const Route = createFileRoute('/payment-dialog-test/')({
  component: PaymentDialogTestPage,
});

function PaymentDialogTestPage() {
  return <PaymentDialogUITest />;
}
