import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

interface ConfirmPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentName: string;
    amount: number;
    installmentCount: number;
    isSubmitting: boolean;
    onConfirm: () => void;
}

export function ConfirmPaymentDialog({
    open,
    onOpenChange,
    studentName,
    amount,
    installmentCount,
    isSubmitting,
    onConfirm,
}: ConfirmPaymentDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-xl p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
                    <DialogTitle className="text-lg font-bold text-gray-800">
                        Confirm Payment
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-gray-500">
                        Please review the payment details before confirming.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-5 space-y-4">
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Student</span>
                            <span className="font-semibold text-gray-800">{studentName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Installments</span>
                            <span className="font-semibold text-gray-800">
                                {installmentCount}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Amount</span>
                            <span className="font-bold text-lg text-blue-600">
                                {formatCurrency(amount)}
                            </span>
                        </div>
                    </div>

                    <p className="text-xs text-gray-400">
                        The amount will be distributed across the selected installments by fee-type
                        priority order.
                    </p>
                </div>

                <div className="flex gap-3 px-6 pb-6">
                    <button
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
