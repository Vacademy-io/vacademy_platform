import { useEffect, useState } from 'react';
import { ArrowsClockwise, DownloadSimple } from '@phosphor-icons/react';

import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import {
    downloadInvoicePdf,
    fetchInvoicePdfObjectUrl,
    resolveInvoicePdfUrl,
    type InvoicePdfSource,
} from '@/services/invoice-pdf';

interface InvoicePreviewDialogProps {
    /** The invoice to preview; null closes/keeps the dialog shut. */
    invoice: InvoicePdfSource | null;
    onClose: () => void;
}

/**
 * Views an invoice's actual stored PDF inline, so an admin can check an invoice without
 * downloading it first. Shared by every invoice list.
 *
 * Renders the real PDF (not an HTML re-render), so what's shown is byte-identical to what
 * the customer receives. The PDF is fetched into a blob object URL rather than pointing
 * the iframe at the storage URL directly — see fetchInvoicePdfObjectUrl for why. If the
 * fetch is blocked (CORS), we surface a clear error plus an "Open in new tab" escape
 * hatch rather than showing an empty frame.
 */
export function InvoicePreviewDialog({ invoice, onClose }: InvoicePreviewDialogProps) {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!invoice) return;
        let cancelled = false;
        let created: string | null = null;

        setLoading(true);
        setError(false);
        setObjectUrl(null);

        fetchInvoicePdfObjectUrl(invoice)
            .then((url) => {
                if (cancelled) {
                    // Dialog closed (or invoice switched) mid-flight — release immediately
                    // so the blob isn't leaked with no one left to revoke it.
                    URL.revokeObjectURL(url);
                    return;
                }
                created = url;
                setObjectUrl(url);
            })
            .catch(() => {
                if (!cancelled) setError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
            if (created) URL.revokeObjectURL(created);
        };
    }, [invoice]);

    const invoiceLabel = invoice
        ? invoice.invoice_number || invoice.invoiceNumber || invoice.id
        : '';

    const content = (
        <div className="flex flex-col overflow-hidden">
            <div className="relative h-[70vh] min-h-0 bg-neutral-100"> {/* design-lint-ignore: viewport-relative PDF viewer height, no vh design token exists */}
                {loading && (
                    <div className="flex h-full items-center justify-center">
                        <DashboardLoader />
                    </div>
                )}
                {!loading && error && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <p className="text-body text-danger-600">
                            Could not load the invoice PDF for preview.
                        </p>
                        {invoice && (
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() =>
                                    window.open(
                                        resolveInvoicePdfUrl(invoice),
                                        '_blank',
                                        'noopener,noreferrer'
                                    )
                                }
                            >
                                <ArrowsClockwise className="mr-1.5 size-4" />
                                Open in new tab
                            </MyButton>
                        )}
                    </div>
                )}
                {!loading && !error && objectUrl && (
                    <iframe
                        title={`Invoice ${invoiceLabel}`}
                        src={objectUrl}
                        className="size-full border-0 bg-white"
                    />
                )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4">
                <MyButton buttonType="secondary" scale="medium" onClick={onClose}>
                    Close
                </MyButton>
                {invoice && (
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onAsyncClick={() => downloadInvoicePdf(invoice)}
                        loadingText="Downloading…"
                    >
                        <DownloadSimple className="mr-1.5 size-4" />
                        Download
                    </MyButton>
                )}
            </div>
        </div>
    );

    return (
        <MyDialog
            open={!!invoice}
            onOpenChange={(o) => !o && onClose()}
            heading={invoiceLabel ? `Invoice ${invoiceLabel}` : 'Invoice'}
            dialogWidth="max-w-4xl"
            content={content}
        />
    );
}
