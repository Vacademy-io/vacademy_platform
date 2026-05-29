import { useEffect, useRef, useState } from 'react';
import { useProductPageStore } from '../-stores/product-page-store';
import { enrollCpoForProductPage } from '../-services/product-page-service';
import {
    fetchCpoSchedule,
    fetchCpoDues,
    payCpoInstallments,
    mapCpoScheduleToDues,
    type CpoInstallmentDue,
} from '@/components/common/enroll-by-invite/-services/enroll-invite-services';
import { CpoInstallmentSelectionStep } from '@/components/common/enroll-by-invite/-components';
import { RazorpayCheckoutForm } from '@/components/common/enroll-by-invite/-components/razorpay-checkout-form';
import type { RazorpayCheckoutFormRef } from '@/components/common/enroll-by-invite/-components/razorpay-checkout-form';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import type { ProductPageData, ProductPageSettings } from '../-types/product-page-types';
import type { FieldValue } from '../-types/product-page-types';

interface CpoInstallmentsCheckoutStepProps {
    pageData: ProductPageData;
    settings: ProductPageSettings;
    vendor: string;
    primaryColor?: string;
    onBack: () => void;
    onSuccess: () => void;
}

export const CpoInstallmentsCheckoutStep = ({
    pageData,
    settings,
    vendor,
    primaryColor = '#2563eb',
    onBack,
    onSuccess,
}: CpoInstallmentsCheckoutStepProps) => {
    const {
        selectedPsOptionIds,
        registrationData,
        userId,
        cpoUserPlanId,
        cpoSelectedSfpIds,
        cpoSelectedTotal,
        cpoCustomAmount,
        setCpoEnrollResult,
        setCpoSelection,
        setCpoCustomAmount,
    } = useProductPageStore();

    const razorpayRef = useRef<RazorpayCheckoutFormRef>(null);
    const [templateDues, setTemplateDues] = useState<CpoInstallmentDue[]>([]);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [scheduleError, setScheduleError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const scheduleFetched = useRef(false);
    // Stable ref for enrolled data — avoids stale closure in Razorpay handler
    const enrolledDataRef = useRef<{ userId: string; userPlanId: string } | null>(null);

    const currency = pageData.currency || 'INR';

    const cpoMapping = pageData.mappings.find(
        (m) =>
            selectedPsOptionIds.includes(m.ps_invite_payment_option_id) &&
            m.payment_option_type?.toUpperCase() === 'CPO'
    );

    const emailEntry = Object.values(registrationData as Record<string, FieldValue>).find(
        (f) => f.type?.toLowerCase().includes('email') || f.name?.toLowerCase().includes('email')
    );
    const userEmail = emailEntry?.value || '';

    const nameEntry = Object.values(registrationData as Record<string, FieldValue>).find(
        (f) => f.name?.toLowerCase().includes('name') || f.type?.toLowerCase().includes('name')
    );
    const userName = nameEntry?.value || '';

    const payAmount = cpoCustomAmount !== undefined ? cpoCustomAmount : cpoSelectedTotal;

    // On mount: fetch the CPO installment template (before enrollment)
    useEffect(() => {
        if (scheduleFetched.current) return;
        scheduleFetched.current = true;

        if (!cpoMapping?.payment_option_id) {
            setScheduleError('No CPO payment option found in selection.');
            return;
        }

        setLoadingSchedule(true);
        fetchCpoSchedule(cpoMapping.payment_option_id)
            .then((cpoDto) => {
                setTemplateDues(mapCpoScheduleToDues(cpoDto));
            })
            .catch((err) => {
                setScheduleError(err instanceof Error ? err.message : 'Failed to load installment schedule.');
            })
            .finally(() => setLoadingSchedule(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Enroll without payment (if not already done), fetch actual SFP dues to get
     * their IDs, then pay all pending SFPs with the user-selected amount as customAmount.
     */
    const doEnrollAndPay = async (buildPayRequest: (
        userId: string,
        userPlanId: string,
        sfpIds: string[],
    ) => Promise<void>) => {
        if (!cpoMapping) {
            setPaymentError('No CPO payment option found.');
            return;
        }

        let currentUserId = enrolledDataRef.current?.userId || userId || '';
        let currentUserPlanId = enrolledDataRef.current?.userPlanId || cpoUserPlanId || '';

        if (!currentUserPlanId) {
            const result = await enrollCpoForProductPage({
                coursePageCode: pageData.code,
                instituteId: pageData.institute_id,
                psInvitePaymentOptionId: cpoMapping.ps_invite_payment_option_id,
                paymentPlanId: cpoMapping.payment_plan_id,
                registrationData: registrationData as Record<string, FieldValue>,
            });
            currentUserId = result.user_id;
            currentUserPlanId = result.user_plan_id;
            // Write to ref FIRST so Razorpay handler always reads fresh data
            enrolledDataRef.current = { userId: currentUserId, userPlanId: currentUserPlanId };
            setCpoEnrollResult(currentUserPlanId);
        } else {
            enrolledDataRef.current = { userId: currentUserId, userPlanId: currentUserPlanId };
        }

        if (!currentUserId || !currentUserPlanId) {
            throw new Error('Enrollment data missing — please go back and retry.');
        }

        // Fetch actual SFP rows to get their IDs
        const sfpDues = await fetchCpoDues({ userId: currentUserId, userPlanId: currentUserPlanId });
        const pendingSfpIds = sfpDues
            .filter((d) => d.status !== 'PAID' && d.status !== 'WAIVED')
            .map((d) => d.id);

        if (pendingSfpIds.length === 0) {
            throw new Error('No pending installments found after enrollment.');
        }

        await buildPayRequest(currentUserId, currentUserPlanId, pendingSfpIds);
    };

    const handleRazorpayPay = async () => {
        setIsProcessing(true);
        setPaymentError(null);
        try {
            await doEnrollAndPay(async (resolvedUserId, resolvedUserPlanId, sfpIds) => {
                const result = await payCpoInstallments({
                    userId: resolvedUserId,
                    userPlanId: resolvedUserPlanId,
                    instituteId: pageData.institute_id,
                    studentFeePaymentIds: sfpIds,
                    customAmount: payAmount,
                    paymentVendor: 'RAZORPAY',
                    currency,
                    email: userEmail,
                    name: userName,
                });

                if (result?.order_id && result?.razorpay_key_id && razorpayRef.current) {
                    razorpayRef.current.openPayment({
                        razorpayKeyId: result.razorpay_key_id,
                        razorpayOrderId: result.order_id,
                        amount: payAmount * 100,
                        currency,
                        email: userEmail,
                    });
                }
            });
        } catch (err) {
            setPaymentError(err instanceof Error ? err.message : 'Could not initiate payment.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRazorpaySuccess = async (razorpayData: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
    }) => {
        setIsProcessing(true);
        setPaymentError(null);
        try {
            // Read from ref — always up-to-date even if this closure is stale
            const enrolled = enrolledDataRef.current;
            if (!enrolled?.userId || !enrolled?.userPlanId) {
                throw new Error('Enrollment data missing. Please try again.');
            }
            const sfpDues = await fetchCpoDues({ userId: enrolled.userId, userPlanId: enrolled.userPlanId });
            const pendingSfpIds = sfpDues
                .filter((d) => d.status !== 'PAID' && d.status !== 'WAIVED')
                .map((d) => d.id);

            await payCpoInstallments({
                userId: enrolled.userId,
                userPlanId: enrolled.userPlanId,
                instituteId: pageData.institute_id,
                studentFeePaymentIds: pendingSfpIds,
                customAmount: payAmount,
                paymentVendor: 'RAZORPAY',
                currency,
                email: userEmail,
                name: userName,
                razorpayPaymentData: razorpayData,
            });
            onSuccess();
        } catch (err) {
            setPaymentError(err instanceof Error ? err.message : 'Payment confirmation failed.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleOtherVendorPay = async () => {
        setIsProcessing(true);
        setPaymentError(null);
        try {
            await doEnrollAndPay(async (resolvedUserId, resolvedUserPlanId, sfpIds) => {
                const result = await payCpoInstallments({
                    userId: resolvedUserId,
                    userPlanId: resolvedUserPlanId,
                    instituteId: pageData.institute_id,
                    studentFeePaymentIds: sfpIds,
                    customAmount: payAmount,
                    paymentVendor: vendor as 'STRIPE' | 'EWAY' | 'RAZORPAY' | 'CASHFREE',
                    currency,
                    email: userEmail,
                    name: userName,
                });

                if (result?.payment_url) {
                    window.location.href = result.payment_url;
                } else {
                    onSuccess();
                }
            });
        } catch (err) {
            setPaymentError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const canPay = cpoSelectedSfpIds.length > 0 || (cpoCustomAmount !== undefined && cpoCustomAmount > 0);

    if (loadingSchedule) {
        return (
            <div className="flex min-h-[300px] items-center justify-center">
                <div className="text-center space-y-3">
                    <Loader2 className="size-8 animate-spin text-blue-500 mx-auto" />
                    <p className="text-sm text-gray-500">Loading installment schedule...</p>
                </div>
            </div>
        );
    }

    if (scheduleError) {
        return (
            <div className="mx-auto max-w-xl px-4 py-8">
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                    {scheduleError}
                </div>
                {!settings.disableBackNavigation && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="mt-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
                    >
                        <ArrowLeft className="size-4" />
                        Back
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-xl px-4 py-8 space-y-6">
            <div>
                <h1 className="text-xl font-bold text-gray-900">Select Installments</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Choose which installments you'd like to pay now
                </p>
            </div>

            <CpoInstallmentSelectionStep
                dues={templateDues}
                currency={currency}
                selectedSfpIds={cpoSelectedSfpIds}
                onSelectionChange={setCpoSelection}
                customAmount={cpoCustomAmount}
                onCustomAmountChange={setCpoCustomAmount}
            />

            {paymentError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {paymentError}
                </div>
            )}

            {canPay && (
                <>
                    {vendor === 'RAZORPAY' ? (
                        <>
                            <RazorpayCheckoutForm
                                ref={razorpayRef}
                                error={paymentError}
                                amount={payAmount}
                                currency={currency}
                                userName=""
                                courseName={pageData.name}
                                courseDescription="Installment payment"
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
                                className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                                style={{ backgroundColor: primaryColor }}
                            >
                                {isProcessing ? (
                                    <><Loader2 className="size-4 animate-spin" /> Processing...</>
                                ) : (
                                    <>Pay {currency} {payAmount.toLocaleString()}</>
                                )}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            disabled={isProcessing}
                            onClick={handleOtherVendorPay}
                            className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                            style={{ backgroundColor: primaryColor }}
                        >
                            {isProcessing ? (
                                <><Loader2 className="size-4 animate-spin" /> Processing...</>
                            ) : (
                                <>Pay {currency} {payAmount.toLocaleString()}</>
                            )}
                        </button>
                    )}
                </>
            )}

            <div className="flex items-center justify-between">
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
    );
};
