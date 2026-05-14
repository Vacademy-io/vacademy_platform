import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { MarkdownResponse, MarkdownResultRow } from '@/services/markdown-offers';
import { CheckCircle, XCircle } from '@phosphor-icons/react';

interface OfferResultsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    action: 'apply' | 'reset';
    response: MarkdownResponse | null;
    rowLabels: Map<string, string>;
}

const friendlyError = (code?: string): string => {
    switch (code) {
        case 'PACKAGE_SESSION_NOT_FOUND':
            return 'Not found in this institute.';
        case 'NO_ACTIVE_PAYMENT_OPTION':
            return 'No active payment option attached.';
        case 'FREE_OPTION_NOT_DISCOUNTABLE':
            return 'FREE plans cannot be discounted.';
        case 'CPO_OPTION_NOT_SUPPORTED':
            return 'Managed via fee management.';
        case 'INSTITUTE_DEFAULT_OPTION_NOT_DISCOUNTABLE':
            return 'Institute-default plan is shared across all books.';
        case 'NO_ACTIVE_PAYMENT_PLAN':
            return 'No active payment plan to update.';
        case 'MULTIPLE_ACTIVE_PAYMENT_PLANS':
            return 'Multiple plans on this option — ambiguous.';
        case 'PAYMENT_OPTION_SHARED_WITH_OTHERS':
            return 'Plan is shared with other items not in the selection.';
        case 'INVALID_MARKDOWN_VALUE':
            return 'Value out of range.';
        default:
            return code || 'Failed.';
    }
};

export const OfferResultsDialog = ({
    open,
    onOpenChange,
    action,
    response,
    rowLabels,
}: OfferResultsDialogProps) => {
    if (!response) return null;

    const successes = response.results.filter((r) => r.success);
    const failures = response.results.filter((r) => !r.success);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {action === 'apply' ? 'Offer Price Applied' : 'Offer Price Reset'}
                    </DialogTitle>
                    <DialogDescription>
                        {response.successCount} of {response.totalRequested} updated successfully.
                        {response.failureCount > 0 ? ` ${response.failureCount} failed.` : ''}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[400px] space-y-3 overflow-y-auto py-2">
                    {successes.length > 0 && (
                        <Section
                            title={`Updated (${successes.length})`}
                            icon={<CheckCircle className="size-4 text-success-500" />}
                            rows={successes}
                            rowLabels={rowLabels}
                            renderDetail={(r) => (
                                <span className="text-xs text-neutral-500">
                                    {formatPrice(r.elevatedPrice, r.currency)}{' '}
                                    <span className="line-through">→</span>{' '}
                                    <span className="font-semibold text-success-600">
                                        {formatPrice(r.newActualPrice, r.currency)}
                                    </span>
                                </span>
                            )}
                        />
                    )}
                    {failures.length > 0 && (
                        <Section
                            title={`Skipped (${failures.length})`}
                            icon={<XCircle className="size-4 text-danger-500" />}
                            rows={failures}
                            rowLabels={rowLabels}
                            renderDetail={(r) => (
                                <span className="text-xs text-danger-600">
                                    {friendlyError(r.errorCode)}
                                </span>
                            )}
                        />
                    )}
                </div>

                <DialogFooter>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        layoutVariant="default"
                        onClick={() => onOpenChange(false)}
                    >
                        Done
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const Section = ({
    title,
    icon,
    rows,
    rowLabels,
    renderDetail,
}: {
    title: string;
    icon: React.ReactNode;
    rows: MarkdownResultRow[];
    rowLabels: Map<string, string>;
    renderDetail: (r: MarkdownResultRow) => React.ReactNode;
}) => (
    <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-700">
            {icon}
            <span>{title}</span>
        </div>
        <ul className="space-y-1.5">
            {rows.map((r) => (
                <li
                    key={r.packageSessionId}
                    className="flex flex-col gap-0.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2"
                >
                    <span className="text-sm text-neutral-800">
                        {rowLabels.get(r.packageSessionId) || r.packageSessionId}
                    </span>
                    {renderDetail(r)}
                </li>
            ))}
        </ul>
    </div>
);

const formatPrice = (v?: number, currency?: string): string => {
    if (v == null) return '—';
    const c = currency || '';
    return `${c} ${v}`.trim();
};
