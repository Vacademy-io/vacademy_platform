import { CheckCircle, DownloadSimple } from '@phosphor-icons/react';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

interface PaymentSuccessStepProps {
    studentName: string;
    amount: number;
    receiptUrl?: string;
    receiptNumber?: string;
    onPayAnother: () => void;
}

export function PaymentSuccessStep({
    studentName,
    amount,
    receiptUrl,
    receiptNumber,
    onPayAnother,
}: PaymentSuccessStepProps) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="flex justify-center mb-4">
                <CheckCircle size={64} weight="duotone" className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Payment Submitted</h2>
            <p className="mt-2 text-gray-500">
                <span className="font-semibold text-gray-700">{formatCurrency(amount)}</span> has
                been recorded for{' '}
                <span className="font-semibold text-gray-700">{studentName}</span>.
            </p>

            {receiptUrl ? (
                <p className="mt-1 text-sm text-emerald-600 font-medium">
                    Receipt {receiptNumber ? `#${receiptNumber} ` : ''}generated successfully.
                </p>
            ) : (
                <p className="mt-1 text-sm text-gray-400">
                    The receipt will be generated and sent automatically.
                </p>
            )}

            <div className="mt-8 flex items-center justify-center gap-3">
                {receiptUrl && (
                    <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <DownloadSimple size={16} weight="bold" />
                        Download Receipt
                    </a>
                )}
                <button
                    onClick={onPayAnother}
                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Pay for Another Student
                </button>
            </div>
        </div>
    );
}
