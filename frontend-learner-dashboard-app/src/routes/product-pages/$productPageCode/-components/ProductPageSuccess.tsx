import { useEffect } from 'react';
import { useProductPageStore } from '../-stores/product-page-store';
import { CheckCircle, BookOpen, ArrowRight } from "@phosphor-icons/react";
import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import type { ProductPageData } from '../-types/product-page-types';

interface ProductPageSuccessProps {
    pageData: ProductPageData;
}

// Origins allowed to receive the PAYMENT_SUCCESS postMessage when this page is
// embedded in an iframe. Sending to a targetOrigin (not '*') prevents leaking
// the event to unintended embedders.
const PAYMENT_SUCCESS_TARGET_ORIGINS = [
    'https://shikshanation.com',
    'https://www.shikshanation.com',
    'http://localhost:3000',
];

export const ProductPageSuccess = ({ pageData }: ProductPageSuccessProps) => {
    const { selectedPsOptionIds, utmParams } = useProductPageStore();

    const enrolledCount = selectedPsOptionIds.length;
    const currency = pageData.currency || pageData.mappings[0]?.payment_plan?.currency || '';

    const enrolledMappings = pageData.mappings.filter((m) =>
        selectedPsOptionIds.includes(m.ps_invite_payment_option_id)
    );

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (window.parent && window.parent !== window) {
            const payload = {
                type: 'PAYMENT_SUCCESS',
                event: 'payment_success',
                status: 'success',
                utm: utmParams,
            };
            PAYMENT_SUCCESS_TARGET_ORIGINS.forEach((origin) => {
                try {
                    window.parent.postMessage(payload, origin);
                } catch {
                    // Ignore — postMessage to a non-matching origin is a no-op,
                    // and we don't want a single bad origin to block the others.
                }
            });
        }
    }, [utmParams]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
            {/* Success icon */}
            <div className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-green-100">
                <CheckCircle className="size-10 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900">You're enrolled!</h1>
            <p className="mt-2 max-w-sm text-center text-sm text-gray-500">
                Successfully enrolled in {enrolledCount} course{enrolledCount !== 1 ? 's' : ''}.
                Start learning right away.
            </p>

            {/* Enrolled course list */}
            <div className="mt-8 w-full max-w-sm space-y-2">
                {enrolledMappings.map((m) => (
                    <div
                        key={m.ps_invite_payment_option_id}
                        className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm"
                    >
                        <CheckCircle className="size-4 shrink-0 text-green-500" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">
                                {m.payment_plan?.name || 'Course'}
                            </p>
                            {m.payment_plan?.validity_in_days > 0 && (
                                <p className="text-xs text-gray-400">
                                    {m.payment_plan.validity_in_days === 365 ? '1 year access'
                                        : m.payment_plan.validity_in_days % 30 === 0
                                            ? `${m.payment_plan.validity_in_days / 30} months access`
                                            : `${m.payment_plan.validity_in_days} days access`}
                                </p>
                            )}
                        </div>
                        {m.payment_plan?.actual_price > 0 && (
                            <span className="shrink-0 text-xs text-gray-400">
                                {currency} {m.payment_plan.actual_price.toLocaleString()}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            <a
                href={`${BASE_URL_LEARNER_DASHBOARD}/dashboard`}
                className="mt-8 flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
                <BookOpen className="size-4" />
                Go to My Courses
                <ArrowRight className="size-4" />
            </a>
        </div>
    );
};
