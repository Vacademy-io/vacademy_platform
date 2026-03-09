import React, { useState } from 'react';
import { Registration } from '../../../-types/registration-types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SectionProps {
    formData: Partial<Registration>;
    updateFormData: (data: Partial<Registration>) => void;
    paymentLink?: string;
    applicantId?: string;
}

type PaymentMethod = 'ONLINE' | 'CASH' | 'UPI' | 'CARD' | 'CHEQUE' | 'SEND_LINK';

// ─── Main Component ──────────────────────────────────────────────────────────

export const PaymentSection: React.FC<SectionProps> = ({
    formData,
    updateFormData,
    paymentLink,
}) => {
    const isPaid = formData.feeStatus === 'PAID';
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | ''>('');
    const [sendEmailAddress, setSendEmailAddress] = useState('');
    const [isSendingLink, setIsSendingLink] = useState(false);

    const registrationFee = 500;

    const handleCopyLink = () => {
        if (paymentLink) {
            navigator.clipboard.writeText(paymentLink);
            toast.success('Payment link copied to clipboard!');
        } else {
            toast.error('Payment link is not available yet.');
        }
    };

    const handleSendLinkToEmail = async () => {
        if (!sendEmailAddress.trim()) {
            toast.warning('Please enter an email address');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendEmailAddress)) {
            toast.warning('Please enter a valid email address');
            return;
        }
        setIsSendingLink(true);
        setTimeout(() => {
            toast.success(`Payment link sent to ${sendEmailAddress}`);
            setIsSendingLink(false);
        }, 1500);
    };

    const handleMarkAsPaid = () => {
        if (!formData.paymentMode) {
            toast.warning('Please select a payment mode before marking as paid');
            return;
        }
        updateFormData({ feeStatus: 'PAID' });
        toast.success('Payment marked as received!');
    };

    const selectMethod = (method: PaymentMethod) => {
        setSelectedPaymentMethod(method);
        if (method !== 'SEND_LINK') {
            updateFormData({ paymentMode: method });
        }
    };

    // ─── PAID state ─────────────────────────────────────────────────
    if (isPaid) {
        return (
            <div className="space-y-6">
                <div className="overflow-hidden rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 shadow-sm">
                    <div className="flex items-center gap-4 p-5">
                        <div className="flex size-12 items-center justify-center rounded-full bg-green-100">
                            <span className="text-2xl">✅</span>
                        </div>
                        <div>
                            <h4 className="text-base font-semibold text-green-800">
                                Payment Received
                            </h4>
                            <p className="text-sm text-green-600">
                                ₹{registrationFee} • Mode: {formData.paymentMode || 'N/A'} •
                                Date: {formData.paymentDate || 'Today'}
                            </p>
                            {formData.transactionId && (
                                <p className="mt-0.5 font-mono text-xs text-green-500">
                                    Ref: {formData.transactionId}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="border-t border-green-200 px-5 py-3">
                        <button
                            onClick={() => updateFormData({ feeStatus: 'PENDING' })}
                            className="text-xs text-green-600 underline underline-offset-2 hover:text-green-700"
                        >
                            ↩ Undo — Mark as Unpaid
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── PENDING state ──────────────────────────────────────────────
    return (
        <div className="space-y-5">

            {/* ── Page Header ───────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-neutral-900">
                        Complete Your Payment
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                        One-time application fee to submit your registration
                    </p>
                </div>
                <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
                    Awaiting Payment
                </span>
            </div>

            {/* ── Invoice Card ──────────────────────────────────────── */}
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                {/* Invoice header */}
                <div className="flex items-center gap-3.5 border-b border-dashed border-neutral-200 px-6 py-5">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary-600 to-primary-400">
                        <span className="text-lg">🎓</span>
                    </div>
                    <div>
                        <h3 className="text-[15px] font-semibold text-neutral-900">
                            Application Fee Invoice
                        </h3>
                        <p className="mt-0.5 text-xs text-neutral-500">
                            One-time registration fee &nbsp;·&nbsp; Generated just now
                        </p>
                    </div>
                </div>

                {/* Line items */}
                <div className="px-6 py-5">
                    <div className="flex items-center justify-between border-b border-neutral-100 py-2.5 text-sm">
                        <span className="text-neutral-500">Application / Registration Fee</span>
                        <span className="font-medium text-neutral-900">₹ {registrationFee.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-neutral-100 py-2.5 text-sm">
                        <span className="text-neutral-500">GST / Taxes</span>
                        <span className="font-medium text-neutral-900">₹ 0.00</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5 text-sm">
                        <span className="text-neutral-500">Processing Charge</span>
                        <span className="font-medium text-green-600">Waived</span>
                    </div>
                </div>

                {/* Total row */}
                <div className="flex items-center justify-between border-t border-dashed border-primary-200 bg-primary-50/60 px-6 py-4">
                    <span className="text-sm font-semibold text-primary-700">Total Amount Due</span>
                    <span className="text-2xl font-bold tracking-tight text-primary-700">
                        ₹ {registrationFee}
                    </span>
                </div>
            </div>

            {/* ── Payment Methods ───────────────────────────────────── */}
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                    Choose Payment Method
                </h4>

                {/* Primary CTA — Pay Online */}
                <button
                    type="button"
                    onClick={() => selectMethod('ONLINE')}
                    className="mb-3 flex w-full items-center gap-3 rounded-lg bg-primary-600 px-5 py-4 text-left text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-lg"
                >
                    <span className="text-xl">🌐</span>
                    <div className="flex-1">
                        <div className="text-sm font-semibold">Pay Online Now</div>
                        <div className="text-xs text-white/70">Cards, Net Banking, Wallets — secure gateway</div>
                    </div>
                    <span className="rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold">→</span>
                </button>

                {/* Secondary grid */}
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                    {([
                        { value: 'UPI' as PaymentMethod, icon: '📱', label: 'UPI / QR Code', desc: 'Scan & pay instantly', recommended: true },
                        { value: 'CARD' as PaymentMethod, icon: '💳', label: 'Card Payment', desc: 'Credit / Debit', recommended: false },
                        { value: 'CASH' as PaymentMethod, icon: '💵', label: 'Cash Received', desc: 'Record cash payment', recommended: false },
                        { value: 'CHEQUE' as PaymentMethod, icon: '📄', label: 'Cheque / DD', desc: 'Record cheque', recommended: false },
                        { value: 'SEND_LINK' as PaymentMethod, icon: '🔗', label: 'Send Link', desc: 'Email / SMS link', recommended: false },
                    ]).map(({ value, icon, label, desc, recommended }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => selectMethod(value)}
                            className={`relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-4 text-center transition-all duration-200 ${
                                selectedPaymentMethod === value
                                    ? 'border-primary-400 bg-primary-50 shadow-sm ring-2 ring-primary-200'
                                    : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                            }`}
                        >
                            {recommended && (
                                <span className="absolute right-0 top-0 rounded-bl-md rounded-tr-lg bg-primary-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                    Recommended
                                </span>
                            )}
                            <span className="text-2xl">{icon}</span>
                            <span className={`text-xs font-semibold ${
                                selectedPaymentMethod === value ? 'text-primary-700' : 'text-neutral-800'
                            }`}>{label}</span>
                            <span className="text-[10px] text-neutral-500">{desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Online Payment Detail ─────────────────────────────── */}
            {selectedPaymentMethod === 'ONLINE' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
                    <h4 className="mb-3 text-sm font-semibold text-blue-800">
                        🌐 Online Payment
                    </h4>
                    <p className="mb-4 text-sm text-blue-700">
                        Open the payment gateway for the parent to pay ₹{registrationFee} online.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {paymentLink ? (
                            <>
                                <a
                                    href={paymentLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
                                >
                                    🌐 Open Payment Page
                                </a>
                                <Button variant="outline" size="sm" onClick={handleCopyLink} className="h-10">
                                    📋 Copy Link
                                </Button>
                            </>
                        ) : (
                            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                ⚠️ Payment link will be available after form submission.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── UPI / QR Code Detail ──────────────────────────────── */}
            {selectedPaymentMethod === 'UPI' && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-5 shadow-sm">
                    <h4 className="mb-3 text-sm font-semibold text-purple-800">
                        📱 UPI / QR Code Payment
                    </h4>
                    <div className="flex gap-6">
                        <div className="flex size-36 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300 bg-white">
                            <span className="block text-3xl">📱</span>
                            <p className="mt-1 text-[10px] font-medium text-purple-500">QR Code</p>
                            <p className="text-[10px] text-purple-400">Available after submission</p>
                        </div>
                        <div className="flex-1 space-y-3">
                            <p className="text-sm text-purple-700">
                                Show this QR code to the parent to scan and pay ₹{registrationFee} via any UPI app.
                            </p>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-neutral-600">
                                    UPI Transaction ID
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                    placeholder="Enter UPI transaction ID after payment"
                                    value={formData.transactionId || ''}
                                    onChange={(e) => updateFormData({ transactionId: e.target.value })}
                                />
                            </div>
                            <Button
                                onClick={handleMarkAsPaid}
                                className="bg-green-600 text-white hover:bg-green-700"
                            >
                                ✅ Confirm Payment — ₹{registrationFee}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Cash / Card / Cheque (Offline) ────────────────────── */}
            {(['CASH', 'CARD', 'CHEQUE'] as PaymentMethod[]).includes(
                selectedPaymentMethod as PaymentMethod
            ) && (
                <div className="rounded-xl border border-green-200 bg-green-50/50 p-5 shadow-sm">
                    <h4 className="mb-4 text-sm font-semibold text-green-800">
                        {selectedPaymentMethod === 'CASH' && '💵 Cash Payment'}
                        {selectedPaymentMethod === 'CARD' && '💳 Card Payment'}
                        {selectedPaymentMethod === 'CHEQUE' && '📄 Cheque / DD'}
                    </h4>

                    <div className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-white p-3">
                        <span className="text-sm font-medium text-neutral-700">
                            Amount to Receive
                        </span>
                        <span className="text-xl font-bold text-green-700">
                            ₹ {registrationFee.toLocaleString('en-IN')}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {selectedPaymentMethod !== 'CASH' && (
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-neutral-600">
                                    {selectedPaymentMethod === 'CHEQUE'
                                        ? 'Cheque / DD Number'
                                        : 'Transaction / Reference ID'}{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                    placeholder={
                                        selectedPaymentMethod === 'CHEQUE'
                                            ? 'Cheque / DD number'
                                            : 'Enter transaction ID'
                                    }
                                    value={formData.transactionId || ''}
                                    onChange={(e) =>
                                        updateFormData({ transactionId: e.target.value })
                                    }
                                />
                            </div>
                        )}
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-neutral-600">
                                Payment Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                value={
                                    formData.paymentDate ||
                                    new Date().toISOString().split('T')[0]
                                }
                                onChange={(e) =>
                                    updateFormData({ paymentDate: e.target.value })
                                }
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-neutral-600">
                                Received By
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                placeholder="Staff name"
                                value={formData.payerName || ''}
                                onChange={(e) =>
                                    updateFormData({ payerName: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div className="mt-5 flex items-center justify-end">
                        <Button
                            onClick={handleMarkAsPaid}
                            className="bg-green-600 px-6 text-white hover:bg-green-700"
                        >
                            ✅ Confirm Payment Received — ₹{registrationFee}
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Send Link via Email ────────────────────────────────── */}
            {selectedPaymentMethod === 'SEND_LINK' && (
                <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm">
                    <h4 className="mb-3 text-sm font-semibold text-sky-800">
                        📧 Send Payment Link
                    </h4>
                    <p className="mb-4 text-sm text-sky-700">
                        Send a secure payment link to the parent's email to pay
                        ₹{registrationFee} at their convenience.
                    </p>
                    <div className="flex gap-3">
                        <input
                            type="email"
                            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                            placeholder="parent@email.com"
                            value={
                                sendEmailAddress ||
                                formData.fatherInfo?.email ||
                                ''
                            }
                            onChange={(e) => setSendEmailAddress(e.target.value)}
                        />
                        <Button
                            onClick={handleSendLinkToEmail}
                            disabled={isSendingLink}
                            className="bg-sky-600 px-5 text-white hover:bg-sky-700"
                        >
                            {isSendingLink ? (
                                <span className="flex items-center gap-2">
                                    <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Sending…
                                </span>
                            ) : (
                                '📧 Send Link'
                            )}
                        </Button>
                    </div>
                    {paymentLink && (
                        <div className="mt-3 flex items-center gap-2">
                            <input
                                type="text"
                                readOnly
                                value={paymentLink}
                                className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600"
                            />
                            <Button variant="outline" size="sm" onClick={handleCopyLink}>
                                📋 Copy
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Info Note ──────────────────────────────────────────── */}
            <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 p-3.5 text-sm leading-relaxed text-green-800">
                <span className="mt-0.5 shrink-0 text-base">🔒</span>
                <span>
                    Your payment is secured and encrypted. The registration form has been saved —
                    the application will be confirmed once payment is received and verified by the front desk.
                </span>
            </div>
        </div>
    );
};
