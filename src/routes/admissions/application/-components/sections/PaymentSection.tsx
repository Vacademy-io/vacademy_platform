import React, { useRef, useState, useEffect } from 'react';
import { Registration } from '../../../-types/registration-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type {
    PaymentOptionDetails,
    PaymentLinkMethod,
} from '../../../-services/applicant-services';
import { initiateManualPayment, generatePaymentLink } from '../../../-services/applicant-services';
import { CardholderIcon, GlobeIcon, ArrowSquareOut } from '@phosphor-icons/react';
import { QRCodeSVG } from 'qrcode.react';
import { getPublicUrl, UploadFileInS3 } from '@/services/upload_file';
import { MyButton } from '@/components/design-system/button';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SectionProps {
    formData: Partial<Registration>;
    updateFormData: (data: Partial<Registration>) => void;
    paymentLink?: string;
    applicantId?: string;
    paymentOptionDetails?: PaymentOptionDetails | null;
}

type PaymentMethod = 'ONLINE' | 'CASH' | 'UPI' | 'CARD' | 'CHEQUE' | 'SEND_LINK';

// ─── Main Component ──────────────────────────────────────────────────────────

export const PaymentSection: React.FC<SectionProps> = ({
    formData,
    updateFormData,
    applicantId,
    paymentOptionDetails,
}) => {
    const isPaid = formData.feeStatus === 'PAID';
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | ''>('');
    const [qrImageUrl, setQrImageUrl] = useState<string>('');
    const [showQrOverlay, setShowQrOverlay] = useState(false);
    const [generatedParentLink, setGeneratedParentLink] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'pay' | 'link'>('pay');

    // Manual payment state
    const [manualTxnId, setManualTxnId] = useState('');
    const [proofFileId, setProofFileId] = useState('');
    const [proofPreviewUrl, setProofPreviewUrl] = useState('');
    const [isUploadingProof, setIsUploadingProof] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const proofInputRef = useRef<HTMLInputElement>(null);

    // Get institute details for learner portal URL
    const { instituteDetails } = useInstituteDetailsStore();
    const learnerPortalBaseUrl = instituteDetails?.learner_portal_base_url;
    const instituteId = instituteDetails?.id ?? '';

    useEffect(() => {
        if (!paymentOptionDetails?.qrCodeFileId) return;
        getPublicUrl(paymentOptionDetails.qrCodeFileId).then((url) => {
            if (url) setQrImageUrl(url);
        });
    }, [paymentOptionDetails?.qrCodeFileId]);

    const registrationFee = paymentOptionDetails?.amount ?? 0;
    const registrationFeeName = paymentOptionDetails?.name ?? 'Application / Registration Fee';
    const registrationFeeCurrency = paymentOptionDetails?.currency ?? 'INR';
    const currencySymbol = registrationFeeCurrency === 'INR' ? '₹' : registrationFeeCurrency;
    const paymentOptionId = paymentOptionDetails?.id ?? '';

    const buildUpiDeepLink = () => {
        const upiVpa = paymentOptionDetails?.upiVpa;
        if (!upiVpa) return '';

        const params = new URLSearchParams();
        params.set('pa', upiVpa);
        if (paymentOptionDetails?.upiPayeeName) params.set('pn', paymentOptionDetails.upiPayeeName);
        if (registrationFee) params.set('am', registrationFee.toFixed(2));
        params.set('cu', registrationFeeCurrency);
        params.set('tn', `${registrationFeeName} payment`);

        return `upi://pay?${params.toString()}`;
    };

    const generatedUpiDeepLink = buildUpiDeepLink();

    const handleGenerateParentLink = (method: PaymentLinkMethod) => {
        if (!applicantId) {
            toast.error('Please submit the application first to generate a payment link.');
            return;
        }
        if (!paymentOptionId) {
            toast.error('Payment option not configured.');
            return;
        }

        const link = generatePaymentLink(
            instituteId,
            applicantId,
            paymentOptionId,
            learnerPortalBaseUrl,
            method,
            paymentOptionDetails?.qrCodeFileId
        );
        setGeneratedParentLink(link);
        navigator.clipboard.writeText(link);
        toast.success(
            `${method === 'ONLINE' ? 'Online payment' : 'UPI payment'} link copied to clipboard!`
        );
    };

    const handleGenerateUpiDeepLink = () => {
        const deepLink = generatedUpiDeepLink;
        if (!deepLink) {
            toast.error('UPI ID not configured for this payment stage.');
            return;
        }
        setGeneratedParentLink(deepLink);
        navigator.clipboard.writeText(deepLink);
        toast.success('UPI deep link copied! Send to parent to open in any UPI app.');
    };

    const generateTxnId = () => {
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        setManualTxnId(`RCPT-${ts}-${rand}`);
    };

    const handleProofUpload = async (file: File) => {
        setProofPreviewUrl(URL.createObjectURL(file));
        const fileId = await UploadFileInS3(
            file,
            setIsUploadingProof,
            applicantId ?? '',
            'INSTITUTE',
            applicantId ?? '',
            true
        );
        if (fileId) {
            setProofFileId(fileId);
            toast.success('Proof uploaded');
        } else {
            toast.error('Failed to upload proof');
            setProofPreviewUrl('');
        }
    };

    const handleConfirmPayment = async () => {
        if (!applicantId) {
            toast.error('Application not submitted yet. Please submit the form first.');
            return;
        }
        if (!manualTxnId.trim()) {
            toast.warning('Please enter or generate a transaction ID');
            return;
        }
        if (!paymentOptionId) {
            toast.error('Payment option not configured.');
            return;
        }
        setIsSubmitting(true);
        try {
            const email = formData.fatherInfo?.email || formData.motherInfo?.email || '';
            await initiateManualPayment(applicantId, paymentOptionId, {
                vendor: 'MANUAL',
                amount: registrationFee,
                currency: registrationFeeCurrency,
                email,
                manual_request: {
                    file_id: proofFileId || null,
                    transaction_id: manualTxnId.trim(),
                },
            });
            updateFormData({
                feeStatus: 'PAID',
                paymentMode: selectedPaymentMethod as string,
                transactionId: manualTxnId.trim(),
                paymentDate: new Date().toISOString().split('T')[0],
            });
            toast.success('Payment recorded successfully!');
        } catch {
            toast.error('Failed to record payment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectMethod = (method: PaymentMethod) => {
        setSelectedPaymentMethod(method);
        setManualTxnId('');
        setProofFileId('');
        setProofPreviewUrl('');
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
                                {currencySymbol}
                                {registrationFee} • Mode: {formData.paymentMode || 'N/A'} • Date:{' '}
                                {formData.paymentDate || 'Today'}
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
                    <h2 className="text-xl font-bold text-neutral-900">Complete Your Payment</h2>
                    <p className="mt-1 text-sm text-neutral-500">
                        One-time fee to submit application
                    </p>
                </div>
            </div>

            {/* ── Invoice Card ──────────────────────────────────────── */}
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                {/* Invoice header */}
                <div className="flex items-center gap-3.5 border-b border-dashed border-neutral-200 px-6 py-5">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary-600 to-primary-400">
                        <CardholderIcon className="text-white" weight="bold" />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-semibold text-neutral-900">Fee Payment</h3>
                    </div>
                </div>

                {/* Line items */}
                <div className="px-6 py-5">
                    <div className="flex items-center justify-between border-b border-neutral-100 py-2.5 text-sm">
                        <span className="text-neutral-500">{registrationFeeName}</span>
                        <span className="font-medium text-neutral-900">
                            {currencySymbol} {registrationFee.toFixed(2)}
                        </span>
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
                        {currencySymbol} {registrationFee}
                    </span>
                </div>
            </div>

            {/* ── Tab Toggle ────────────────────────────────────────── */}
            <div className="flex rounded-lg border border-primary-200 bg-primary-50 p-1">
                <button
                    type="button"
                    onClick={() => setActiveTab('pay')}
                    className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                        activeTab === 'pay'
                            ? 'bg-white text-primary-700 shadow-sm'
                            : 'text-primary-400 hover:text-primary-600'
                    }`}
                >
                    Pay Now
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('link')}
                    className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                        activeTab === 'link'
                            ? 'bg-white text-primary-700 shadow-sm'
                            : 'text-primary-400 hover:text-primary-600'
                    }`}
                >
                    Generate Link
                </button>
            </div>

            {activeTab === 'pay' && (
                <>
                    {/* ── Payment Methods ───────────────────────────────────── */}
                    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                            Pay Now
                        </h4>

                        {/* Secondary grid */}
                        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                            {[
                                {
                                    value: 'UPI' as PaymentMethod,
                                    label: 'UPI / QR Code',
                                    desc: 'Scan & pay instantly',
                                },
                                {
                                    value: 'CASH' as PaymentMethod,
                                    label: 'Cash Received',
                                    desc: 'Record cash payment',
                                },
                            ].map(({ value, label, desc }) => (
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
                                    <span
                                        className={`text-xs font-semibold ${
                                            selectedPaymentMethod === value
                                                ? 'text-primary-700'
                                                : 'text-neutral-800'
                                        }`}
                                    >
                                        {label}
                                    </span>
                                    <span className="text-[10px] text-neutral-500">{desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {(['CASH'] as PaymentMethod[]).includes(
                        selectedPaymentMethod as PaymentMethod
                    ) && (
                        <div className="rounded-xl border border-neutral-200 p-5 shadow-sm">
                            <h4 className="mb-4 text-sm font-semibold">
                                {selectedPaymentMethod === 'CASH' && 'Cash Payment'}
                            </h4>
                            <div className="mb-4 flex items-center justify-between rounded-lg border bg-white p-2">
                                <span className="text-sm font-medium text-neutral-700">
                                    Amount to Receive
                                </span>
                                <span className="text-xl font-bold text-green-700">
                                    {currencySymbol} {registrationFee.toLocaleString('en-IN')}
                                </span>
                            </div>

                            <div className="space-y-4">
                                {/* Proof upload */}
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-neutral-600">
                                        Payment Proof{' '}
                                        <span className="text-neutral-400">
                                            (
                                            {selectedPaymentMethod === 'CHEQUE'
                                                ? 'cheque image'
                                                : 'receipt / screenshot'}
                                            )
                                        </span>
                                    </label>
                                    <input
                                        ref={proofInputRef}
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleProofUpload(file);
                                        }}
                                    />
                                    {proofPreviewUrl ? (
                                        <div className="relative inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                                            <img
                                                src={proofPreviewUrl}
                                                alt="Proof"
                                                className="size-16 rounded object-cover"
                                            />
                                            {isUploadingProof && (
                                                <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                                                    <span className="size-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setProofPreviewUrl('');
                                                    setProofFileId('');
                                                }}
                                                className="ml-1 text-xs text-red-500 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => proofInputRef.current?.click()}
                                            className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-100"
                                        >
                                            📎 Upload receipt / screenshot
                                        </button>
                                    )}
                                </div>

                                {/* Transaction ID + Generate */}
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-neutral-600">
                                        {selectedPaymentMethod === 'CHEQUE'
                                            ? 'Cheque / DD Number'
                                            : 'Transaction / Receipt ID'}{' '}
                                        <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                            placeholder={
                                                selectedPaymentMethod === 'CHEQUE'
                                                    ? 'Cheque / DD number'
                                                    : selectedPaymentMethod === 'CASH'
                                                      ? 'Auto-generate or enter a receipt ID'
                                                      : 'Enter transaction ID'
                                            }
                                            value={manualTxnId}
                                            onChange={(e) => setManualTxnId(e.target.value)}
                                        />
                                        {selectedPaymentMethod !== 'CHEQUE' && (
                                            <button
                                                type="button"
                                                onClick={generateTxnId}
                                                className="shrink-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-600 transition hover:border-neutral-400 hover:bg-neutral-50"
                                            >
                                                Generate
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-end">
                                    <MyButton
                                        disabled={isSubmitting || isUploadingProof}
                                        onClick={handleConfirmPayment}
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center gap-2">
                                                <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                Recording…
                                            </span>
                                        ) : (
                                            `Confirm Payment`
                                        )}
                                    </MyButton>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── UPI / QR Code Detail ──────────────────────────────── */}
                    {selectedPaymentMethod === 'UPI' && (
                        <div className="rounded-xl border p-5 shadow-sm">
                            <h4 className="mb-3 text-sm font-semibold">UPI Payment</h4>
                            <div className="flex gap-6">
                                {/* QR Code image */}
                                {qrImageUrl ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowQrOverlay(true)}
                                        className="group relative flex size-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-purple-300 bg-white shadow-sm transition hover:border-purple-400"
                                        title="Click to enlarge"
                                    >
                                        <img
                                            src={qrImageUrl}
                                            alt="Payment QR Code"
                                            className="size-full object-contain p-1"
                                        />
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-medium text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                                            Open
                                        </span>
                                    </button>
                                ) : (
                                    <div className="flex size-36 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300 bg-white px-2 text-center">
                                        {paymentOptionDetails?.upiVpa ? (
                                            <>
                                                {generatedUpiDeepLink && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowQrOverlay(true)}
                                                        className="mt-1 rounded-md border border-purple-100 bg-white p-1 transition hover:border-purple-300"
                                                        title="Open large QR"
                                                    >
                                                        <QRCodeSVG
                                                            value={generatedUpiDeepLink}
                                                            size={88}
                                                            level="M"
                                                            includeMargin
                                                        />
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <p className="mt-1 text-[10px] font-medium text-purple-500">
                                                    QR Code
                                                </p>
                                                <p className="text-[10px] text-purple-400">
                                                    Not configured
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}
                                <div className="flex-1 space-y-3">
                                    {/* Proof upload */}
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-neutral-600">
                                            Payment Image{' '}
                                            <span className="text-neutral-400">(optional)</span>
                                        </label>
                                        <input
                                            ref={proofInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleProofUpload(file);
                                            }}
                                        />
                                        {proofPreviewUrl ? (
                                            <div className="relative inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                                                <img
                                                    src={proofPreviewUrl}
                                                    alt="Proof"
                                                    className="size-16 rounded object-cover"
                                                />
                                                {isUploadingProof && (
                                                    <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                                                        <span className="size-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setProofPreviewUrl('');
                                                        setProofFileId('');
                                                    }}
                                                    className="ml-1 text-xs text-red-500 hover:underline"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => proofInputRef.current?.click()}
                                                className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-100"
                                            >
                                                Upload image
                                            </button>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-neutral-600">
                                            Transaction ID
                                            <span className="text-red-500">*</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                                placeholder="e.g. 312345678901"
                                                value={manualTxnId}
                                                onChange={(e) => setManualTxnId(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={generateTxnId}
                                                className="shrink-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-600 transition hover:border-neutral-400 hover:bg-neutral-50"
                                            >
                                                Generate
                                            </button>
                                        </div>
                                    </div>

                                    <MyButton
                                        disabled={isSubmitting || isUploadingProof}
                                        onClick={handleConfirmPayment}
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center gap-2">
                                                <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                Recording…
                                            </span>
                                        ) : (
                                            <>Confirm Payment</>
                                        )}
                                    </MyButton>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── Generate Link for Parent ──────────────────────────── */}
            {activeTab === 'link' && applicantId && (
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                        <div>
                            <h4 className="text-sm font-semibold">
                                Generate Payment Link for Payment
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Share a link with parents to complete payment on their device
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => handleGenerateParentLink('ONLINE')}
                            className="flex items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-4 py-2 text-sm font-medium  transition hover:bg-primary-100"
                        >
                            <GlobeIcon className="size-4" weight="bold" />
                            Online Link
                        </button>

                        <button
                            type="button"
                            onClick={handleGenerateUpiDeepLink}
                            disabled={!paymentOptionDetails?.upiVpa}
                            title={
                                !paymentOptionDetails?.upiVpa
                                    ? 'Configure UPI ID in stage settings'
                                    : undefined
                            }
                            className="flex items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-4 py-2 text-sm font-medium transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ArrowSquareOut className="size-4" weight="bold" />
                            UPI App Link
                        </button>
                    </div>

                    {generatedParentLink && (
                        <div className="mt-5 rounded-xl border border-primary-200 bg-primary-50/40 p-4">
                            <p className="flex items-center justify-center text-xs font-semibold uppercase tracking-wide text-primary-700">
                                Scan QR to open payment link
                            </p>
                            <div className="mt-3 flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-start sm:gap-4">
                                <div className="rounded-lg border border-primary-100 bg-white p-2">
                                    <QRCodeSVG
                                        value={generatedParentLink}
                                        size={156}
                                        level="M"
                                        includeMargin
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── QR Code Dialog Overlay ─────────────────────────── */}
            <Dialog open={showQrOverlay} onOpenChange={setShowQrOverlay}>
                <DialogContent className="w-full max-w-sm rounded-2xl p-6">
                    <p className="mb-4 text-center text-sm font-semibold text-neutral-700">
                        Scan to Pay — {currencySymbol}
                        {registrationFee}
                    </p>
                    {qrImageUrl && (
                        <img
                            src={qrImageUrl}
                            alt="Payment QR Code"
                            className="mx-auto max-h-96 max-w-96 rounded-lg object-contain"
                        />
                    )}
                    {!qrImageUrl && generatedUpiDeepLink && (
                        <div className="mx-auto w-fit rounded-lg border border-purple-100 bg-white p-2">
                            <QRCodeSVG
                                value={generatedUpiDeepLink}
                                size={256}
                                level="M"
                                includeMargin
                            />
                        </div>
                    )}
                    {!qrImageUrl && paymentOptionDetails?.upiVpa && (
                        <p className="mt-3 text-center text-xs font-medium text-neutral-600">
                            UPI ID: {paymentOptionDetails.upiVpa}
                        </p>
                    )}
                    <p className="mt-3 text-center text-xs text-neutral-400">
                        Click outside or press Escape to close
                    </p>
                </DialogContent>
            </Dialog>
        </div>
    );
};
