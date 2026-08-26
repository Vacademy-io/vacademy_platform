import { useEffect, useRef, useState } from 'react';
import { useProductPageStore } from '../-stores/product-page-store';
import { enrollForProductPage } from '../-services/product-page-service';
import {
    pushCombinedPaymentInitiated,
    pushCombinedEnrollmentSuccess,
    pushCombinedPaymentFailed,
} from '@/components/common/enroll-by-invite/-utils/gtm';
import { RazorpayCheckoutForm } from '@/components/common/enroll-by-invite/-components/razorpay-checkout-form';
import type { RazorpayCheckoutFormRef } from '@/components/common/enroll-by-invite/-components/razorpay-checkout-form';
import { ArrowLeft, SpinnerGap, ShieldCheck } from "@phosphor-icons/react";
import type { ProductPageData, ProductPageSettings } from '../-types/product-page-types';
import { resolveLearnerIdentity } from '../-utils/learner-identity';

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
    primaryColor = '#2563eb', // design-lint-ignore: page-builder default color
    onBack,
    onSuccess,
}: CombinedPaymentStepProps) => {
    const {
        selectedPsOptionIds, registrationData, userId, couponCode,
        finalPrice, utmParams,
    } = useProductPageStore();

    const razorpayRef = useRef<RazorpayCheckoutFormRef>(null);
    const hasAutoEnrolledRef = useRef(false);
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

    // These three prefill the payment vendor's contact block, so they must be
    // the same values the enrolment is created under. Shared resolver: a label
    // search for "name" also matches "School Name". See learner-identity.
    const {
        email: userEmail,
        phone: userPhone,
        name: userName,
    } = resolveLearnerIdentity(Object.values(registrationData));

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

    // Auto-skip the payment step for free enrollments — mirrors the invite flow
    // (learner-invitation-response): when the total is 0, enroll immediately on
    // mount instead of waiting for a button click. The ref guards against
    // double-firing (React Strict Mode / re-renders).
    useEffect(() => {
        if (amount <= 0 && !hasAutoEnrolledRef.current && !isProcessing) {
            hasAutoEnrolledRef.current = true;
            handleFreeEnroll();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [amount]);

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

    return (
        <>
            {/* Line items and totals live in CheckoutLayout's OrderSummaryPanel,
                which is on screen throughout checkout — this step shows only
                the payment action itself. */}
            <div className="px-5 py-6 sm:px-6">
                <div className="min-w-0">
                    <h1 className="mb-1 text-lg font-bold text-gray-900">Review &amp; Pay</h1>
                    <p className="mb-6 text-caption text-gray-500">
                        Completing enrollment for {selectedPsOptionIds.length} course{selectedPsOptionIds.length !== 1 ? 's' : ''} · {currency} {amount.toLocaleString()} payable
                    </p>

                    {paymentError && (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {paymentError}
                        </div>
                    )}

                    {/* Vendor-specific payment UI — free path driven by amount only, not vendor label */}
                    {amount <= 0 ? (
                        // Free enrollment auto-completes on mount (see useEffect above);
                        // show a loading state, and only fall back to a retry button on error.
                        paymentError ? (
                            <button
                                type="button"
                                disabled={isProcessing}
                                onClick={handleFreeEnroll}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                            >
                                {isProcessing ? (
                                    <><SpinnerGap className="size-4 animate-spin" /> Completing your enrollment…</>
                                ) : (
                                    'Retry Enrollment'
                                )}
                            </button>
                        ) : (
                            <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white">
                                <SpinnerGap className="size-4 animate-spin" /> Completing your enrollment…
                            </div>
                        )
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
                                    <><SpinnerGap className="size-4 animate-spin" /> Opening payment...</>
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
                                <><SpinnerGap className="size-4 animate-spin" /> Processing...</>
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
            </div>
        </>
    );
};
