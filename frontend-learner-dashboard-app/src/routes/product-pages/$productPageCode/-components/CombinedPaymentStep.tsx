import { useRef, useState } from 'react';
import { useProductPageStore } from '../-stores/product-page-store';
import { enrollForProductPage } from '../-services/product-page-service';
import {
    pushCombinedPaymentInitiated,
    pushCombinedEnrollmentSuccess,
    pushCombinedPaymentFailed,
} from '@/components/common/enroll-by-invite/-utils/gtm';
import { RazorpayCheckoutForm } from '@/components/common/enroll-by-invite/-components/razorpay-checkout-form';
import type { RazorpayCheckoutFormRef } from '@/components/common/enroll-by-invite/-components/razorpay-checkout-form';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import type { ProductPageData, ProductPageSettings } from '../-types/product-page-types';

interface CombinedPaymentStepProps {
    pageData: ProductPageData;
    settings: ProductPageSettings;
    instituteId: string;
    vendor: string;
    primaryColor?: string;
    onBack: () => void;
    onSuccess: () => void;
}

export const CombinedPaymentStep = ({
    pageData,
    settings,
    instituteId,
    vendor,
    primaryColor = '#2563eb',
    onBack,
    onSuccess,
}: CombinedPaymentStepProps) => {
    const {
        selectedPsOptionIds, registrationData, userId, couponCode,
        discountAmount, totalPrice, finalPrice, utmParams,
    } = useProductPageStore();

    const razorpayRef = useRef<RazorpayCheckoutFormRef>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);

    const selectedMappings = pageData.mappings
        .filter((m) => selectedPsOptionIds.includes(m.ps_invite_payment_option_id))
        .map((m) => ({
            ps_invite_payment_option_id: m.ps_invite_payment_option_id,
            payment_plan_id: m.payment_plan_id,
            amount: m.payment_plan?.actual_price ?? 0,
        }));

    const currency = (pageData.currency || pageData.mappings[0]?.payment_plan?.currency || 'INR') as string;
    const amount = finalPrice();
    const subtotal = totalPrice();

    const emailEntry = Object.values(registrationData).find(
        (f) => f.type?.toLowerCase().includes('email') || f.name?.toLowerCase().includes('email')
    );
    const phoneEntry = Object.values(registrationData).find(
        (f) => f.type?.toLowerCase().includes('phone') || f.name?.toLowerCase().includes('phone') || f.name?.toLowerCase().includes('mobile')
    );
    const nameEntry = Object.values(registrationData).find(
        (f) => f.name?.toLowerCase().includes('name') && !f.name?.toLowerCase().includes('email') && !f.name?.toLowerCase().includes('phone')
    );

    const userEmail = emailEntry?.value || '';
    const userPhone = phoneEntry?.value || '';
    const userName = nameEntry?.value || '';

    const doEnroll = async (paymentInitiationRequest: Record<string, unknown>) => {
        setIsProcessing(true);
        setPaymentError(null);
        try {
            pushCombinedPaymentInitiated(amount, selectedPsOptionIds.length, vendor, utmParams);
            const result = await enrollForProductPage({
                coursePageCode: pageData.code,
                instituteId: pageData.institute_id,
                userId: userId || '',
                selectedMappings,
                couponCode: couponCode || undefined,
                registrationData,
                paymentInitiationRequest,
                utmParams,
            });

            if (result.payment_url) {
                window.location.href = result.payment_url;
                return;
            }

            pushCombinedEnrollmentSuccess(amount, selectedPsOptionIds.length, utmParams);
            onSuccess();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Payment failed. Please try again.';
            setPaymentError(msg);
            pushCombinedPaymentFailed(msg, vendor, utmParams);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRazorpaySuccess = async (razorpayData: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
    }) => {
        await doEnroll({
            vendor: 'RAZORPAY',
            amount,
            currency,
            razorpay_request: razorpayData,
        });
    };

    const handleFreeEnroll = () => {
        doEnroll({ vendor: 'FREE', amount: 0, currency });
    };

    const handleRazorpayPay = async () => {
        setIsProcessing(true);
        setPaymentError(null);
        try {
            pushCombinedPaymentInitiated(amount, selectedPsOptionIds.length, vendor, utmParams);
            const result = await enrollForProductPage({
                coursePageCode: pageData.code,
                instituteId: pageData.institute_id,
                userId: userId || '',
                selectedMappings,
                couponCode: couponCode || undefined,
                registrationData,
                paymentInitiationRequest: {
                    vendor: 'RAZORPAY',
                    amount,
                    currency,
                    razorpay_request: {},
                },
                utmParams,
            });

            if (result.order_id && result.razorpay_key_id && razorpayRef.current) {
                razorpayRef.current.openPayment({
                    razorpayKeyId: result.razorpay_key_id,
                    razorpayOrderId: result.order_id,
                    amount: amount * 100,
                    currency,
                    contact: userPhone,
                    email: userEmail,
                });
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Could not initiate payment.';
            setPaymentError(msg);
            pushCombinedPaymentFailed(msg, vendor, utmParams);
        } finally {
            setIsProcessing(false);
        }
    };

    const orderSummaryContent = (
        <>
            <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="font-semibold text-gray-900">Order Summary</h2>
            </div>
            <div className="divide-y divide-gray-100">
                {selectedMappings.map((m) => {
                    const mapping = pageData.mappings.find(
                        (pm) => pm.ps_invite_payment_option_id === m.ps_invite_payment_option_id
                    );
                    const nameParts = [mapping?.package_name, mapping?.level_name, mapping?.session_name].filter(Boolean);
                    const courseName = nameParts.join(' | ') || mapping?.payment_plan?.name || 'Course';
                    return (
                        <div key={m.ps_invite_payment_option_id} className="px-5 py-3">
                            <p className="mb-1 text-xs font-semibold text-gray-800 leading-snug">{courseName}</p>
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>{mapping?.payment_plan?.name}</span>
                                <span className="font-medium text-gray-900">
                                    {m.amount > 0 ? `${currency} ${m.amount.toLocaleString()}` : 'Free'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="space-y-2 border-t border-gray-100 px-5 py-4">
                {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                        <span>Coupon ({couponCode})</span>
                        <span>− {currency} {discountAmount.toLocaleString()}</span>
                    </div>
                )}
                {subtotal !== amount && (
                    <div className="flex justify-between text-sm text-gray-400 line-through">
                        <span>Subtotal</span>
                        <span>{currency} {subtotal.toLocaleString()}</span>
                    </div>
                )}
                <div className="flex justify-between pt-1 text-base font-bold text-gray-900">
                    <span>Total</span>
                    <span>{currency} {amount.toLocaleString()}</span>
                </div>
                <p className="text-right text-xs text-gray-400">All prices in {currency}</p>
            </div>
        </>
    );

    return (
        <>
            {/* Two-column body */}
            <div className="mx-auto max-w-3xl px-4 py-8 lg:flex lg:items-start lg:gap-8">
                {/* Left: payment form */}
                <div className="min-w-0 flex-1">
                    {/* Order summary — mobile only, shown above the payment form */}
                    <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:hidden">
                        {orderSummaryContent}
                    </div>

                    <h1 className="mb-1 text-xl font-bold text-gray-900">Payment</h1>
                    <p className="mb-6 text-sm text-gray-500">
                        Complete your enrollment for {selectedPsOptionIds.length} course{selectedPsOptionIds.length !== 1 ? 's' : ''}
                    </p>

                    {paymentError && (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {paymentError}
                        </div>
                    )}

                    {/* Vendor-specific payment UI — free path driven by amount only, not vendor label */}
                    {amount === 0 ? (
                        <button
                            type="button"
                            disabled={isProcessing}
                            onClick={handleFreeEnroll}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                            {isProcessing ? (
                                <><Loader2 className="size-4 animate-spin" /> Processing...</>
                            ) : (
                                'Complete Enrollment (Free)'
                            )}
                        </button>
                    ) : vendor === 'RAZORPAY' ? (
                        <>
                            <RazorpayCheckoutForm
                                ref={razorpayRef}
                                error={paymentError}
                                amount={amount}
                                currency={currency}
                                userName={userName}
                                courseName={pageData.name}
                                courseDescription={`Enrollment for ${selectedPsOptionIds.length} course(s)`}
                                onPaymentReady={handleRazorpaySuccess}
                                onError={(err) => {
                                    setPaymentError(err);
                                    setIsProcessing(false);
                                }}
                                isProcessing={isProcessing}
                            />
                            <button
                                type="button"
                                disabled={isProcessing}
                                onClick={handleRazorpayPay}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                                style={{ backgroundColor: primaryColor }}
                            >
                                {isProcessing ? (
                                    <><Loader2 className="size-4 animate-spin" /> Opening payment...</>
                                ) : (
                                    <>Pay {currency} {amount.toLocaleString()}</>
                                )}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => doEnroll({ vendor, amount, currency })}
                            className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                            style={{ backgroundColor: primaryColor }}
                        >
                            {isProcessing ? (
                                <><Loader2 className="size-4 animate-spin" /> Processing...</>
                            ) : (
                                <>Pay {currency} {amount.toLocaleString()}</>
                            )}
                        </button>
                    )}

                    <div className="mt-6 flex items-center justify-between">
                        {!settings.disableBackNavigation ? (
                            <button
                                type="button"
                                onClick={onBack}
                                disabled={isProcessing}
                                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
                            >
                                <ArrowLeft className="size-4" />
                                Back
                            </button>
                        ) : <div />}
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <ShieldCheck className="size-3.5" />
                            Secured payment
                        </div>
                    </div>
                </div>

                {/* Right: order summary (desktop only) */}
                <div className="hidden lg:mt-0 lg:block lg:w-72 lg:shrink-0">
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        {orderSummaryContent}
                    </div>
                </div>
            </div>
        </>
    );
};
