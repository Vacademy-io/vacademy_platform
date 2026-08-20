import { useQuery } from '@tanstack/react-query';

import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { fetchInvoiceById } from '@/services/invoice-service';
import { InvoicePreviewDialog } from './invoice-preview-dialog';

interface InvoicePreviewByIdDialogProps {
    /** Invoice to preview; null keeps the dialog shut. */
    invoiceId: string | null;
    /** Shown in the header while the invoice itself is still loading. */
    invoiceNumber?: string | null;
    onClose: () => void;
}

/**
 * Previews an invoice when all the caller has is its id.
 *
 * Listings that only carry an invoice number (the Manage Payments table, for one) have no
 * PDF URL to hand {@link InvoicePreviewDialog}: the URL is presigned per invoice, and doing
 * that for every row of a listing would be one media-service round trip per row. So the id
 * is resolved here — one fetch, only when someone actually asks to see the document — and
 * the resolved invoice is handed to the shared preview dialog unchanged.
 *
 * The intermediate loading/error dialogs exist so the click has immediate feedback rather
 * than a blank pause before the preview appears.
 */
export function InvoicePreviewByIdDialog({
    invoiceId,
    invoiceNumber,
    onClose,
}: InvoicePreviewByIdDialogProps) {
    const {
        data: invoice,
        isPending,
        isError,
    } = useQuery({
        queryKey: ['invoice-detail', invoiceId],
        queryFn: () => fetchInvoiceById(invoiceId as string),
        enabled: !!invoiceId,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    const heading = invoiceNumber ? `Invoice ${invoiceNumber}` : 'Invoice';

    if (invoiceId && isError) {
        return (
            <MyDialog
                open
                onOpenChange={(o) => !o && onClose()}
                heading={heading}
                dialogWidth="max-w-md"
                content={
                    <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
                        <p className="text-body text-danger-600">
                            Could not load this invoice. It may have been removed.
                        </p>
                        <MyButton buttonType="secondary" scale="medium" onClick={onClose}>
                            Close
                        </MyButton>
                    </div>
                }
            />
        );
    }

    if (invoiceId && isPending) {
        return (
            <MyDialog
                open
                onOpenChange={(o) => !o && onClose()}
                heading={heading}
                dialogWidth="max-w-md"
                content={
                    <div className="flex items-center justify-center px-6 py-12">
                        <DashboardLoader />
                    </div>
                }
            />
        );
    }

    return <InvoicePreviewDialog invoice={invoiceId ? invoice ?? null : null} onClose={onClose} />;
}
