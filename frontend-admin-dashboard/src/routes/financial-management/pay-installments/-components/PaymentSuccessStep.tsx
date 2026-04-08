import { CheckCircle, DownloadSimple } from '@phosphor-icons/react';
import dayjs from 'dayjs';
import { AllocatePaymentResponse, ReceiptLineItem } from '@/services/manage-finances';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    PAID: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    PARTIAL_PAID: { bg: 'bg-amber-50', text: 'text-amber-700' },
    PENDING: { bg: 'bg-slate-100', text: 'text-slate-600' },
    OVERDUE: { bg: 'bg-red-50', text: 'text-red-700' },
};

interface PaymentSuccessStepProps {
    studentName: string;
    receipt?: AllocatePaymentResponse;
    onPayAnother: () => void;
}

export function PaymentSuccessStep({ studentName, receipt, onPayAnother }: PaymentSuccessStepProps) {
    const hasReceipt = receipt && receipt.invoice_id;

    return (
        <div className="space-y-4">
            {/* Success banner */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                <div className="flex justify-center mb-3">
                    <CheckCircle size={56} weight="duotone" className="text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Payment Submitted</h2>
                <p className="mt-1 text-gray-500">
                    Payment recorded for{' '}
                    <span className="font-semibold text-gray-700">{studentName}</span>.
                </p>
                {!hasReceipt && (
                    <p className="mt-1 text-sm text-gray-400">
                        The receipt will be generated and sent automatically.
                    </p>
                )}
            </div>

            {/* Receipt card */}
            {hasReceipt && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Receipt header */}
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-start justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Receipt No</p>
                            <p className="text-base font-bold text-gray-800 mt-0.5">{receipt.receipt_number}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</p>
                            <p className="text-sm font-semibold text-gray-700 mt-0.5">
                                {receipt.receipt_date ? dayjs(receipt.receipt_date).format('DD MMM YYYY') : '—'}
                            </p>
                        </div>
                    </div>

                    {/* Meta row */}
                    <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-x-8 gap-y-1 text-sm">
                        <div>
                            <span className="text-gray-400 text-xs uppercase tracking-wide font-semibold">Student: </span>
                            <span className="font-semibold text-gray-700">{studentName}</span>
                        </div>
                        {receipt.payment_mode && (
                            <div>
                                <span className="text-gray-400 text-xs uppercase tracking-wide font-semibold">Mode: </span>
                                <span className="font-semibold text-gray-700">{receipt.payment_mode}</span>
                            </div>
                        )}
                        {receipt.transaction_id && (
                            <div>
                                <span className="text-gray-400 text-xs uppercase tracking-wide font-semibold">Txn ID: </span>
                                <span className="font-semibold text-gray-700">{receipt.transaction_id}</span>
                            </div>
                        )}
                    </div>

                    {/* Line items table */}
                    {receipt.line_items && receipt.line_items.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/80">
                                        <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">#</th>
                                        <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fee Type</th>
                                        <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                                        <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Expected</th>
                                        <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Paid</th>
                                        <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Balance</th>
                                        <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {receipt.line_items.map((item: ReceiptLineItem, idx: number) => {
                                        const style = STATUS_STYLES[item.status] || STATUS_STYLES['PENDING']!;
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50/40">
                                                <td className="py-2.5 px-4 text-gray-400 font-medium">{idx + 1}</td>
                                                <td className="py-2.5 px-4">
                                                    <p className="font-semibold text-gray-800">{item.fee_type_name || '—'}</p>
                                                    {item.cpo_name && <p className="text-xs text-gray-400 mt-0.5">{item.cpo_name}</p>}
                                                </td>
                                                <td className="py-2.5 px-4 text-gray-600">
                                                    {item.due_date ? dayjs(item.due_date).format('DD MMM YYYY') : '—'}
                                                </td>
                                                <td className="py-2.5 px-4 text-gray-700 text-right">{formatCurrency(item.amount_expected)}</td>
                                                <td className="py-2.5 px-4 text-emerald-700 font-semibold text-right">{formatCurrency(item.amount_paid)}</td>
                                                <td className="py-2.5 px-4 text-red-600 font-semibold text-right">
                                                    {item.balance > 0 ? formatCurrency(item.balance) : '—'}
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}>
                                                        {item.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-200 bg-gray-50/60">
                                        <td colSpan={3} />
                                        <td className="py-3 px-4 text-xs font-bold text-gray-500 text-right uppercase tracking-wide">Total Expected</td>
                                        <td className="py-3 px-4 text-sm font-bold text-gray-800 text-right">{formatCurrency(receipt.total_expected ?? 0)}</td>
                                        <td className="py-3 px-4 text-sm font-bold text-gray-800 text-right">{formatCurrency(receipt.balance_due ?? 0)}</td>
                                        <td />
                                    </tr>
                                    <tr className="bg-gray-50/60">
                                        <td colSpan={3} />
                                        <td className="py-1 px-4 text-xs font-bold text-gray-500 text-right uppercase tracking-wide">Total Paid</td>
                                        <td className="py-1 px-4 text-sm font-bold text-emerald-700 text-right" colSpan={2}>{formatCurrency(receipt.total_paid ?? 0)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* Amount paid now highlight */}
                    {receipt.amount_paid_now != null && (
                        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
                            <div className="text-right">
                                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Amount Paid Now</p>
                                <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{formatCurrency(receipt.amount_paid_now)}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
                {receipt?.download_url && (
                    <a
                        href={receipt.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <DownloadSimple size={15} weight="bold" />
                        Download Receipt
                    </a>
                )}
                <button
                    onClick={onPayAnother}
                    className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Pay for Another Student
                </button>
            </div>
        </div>
    );
}
