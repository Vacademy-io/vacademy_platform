import { useState, useEffect, useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useProductPageStore } from '../-stores/product-page-store';
import { validateCoupon } from '../-services/product-page-service';

/**
 * Turns the API's message codes into something a parent can act on. Anything
 * unrecognised falls through to a plain refusal rather than leaking the code.
 */
const couponMessage = (code?: string): string => {
    switch (code) {
        case 'COUPON_BELOW_MIN_ITEMS':
            return 'This code needs more courses in your cart.';
        case 'COUPON_EXPIRED':
            return 'This code has expired.';
        case 'COUPON_NOT_STARTED':
            return 'This code is not active yet.';
        case 'COUPON_LIMIT_REACHED':
            return 'This code has been fully used.';
        case 'COUPON_EMAIL_RESTRICTED':
            return 'This code is not available for your email.';
        case 'COUPON_NOT_APPLICABLE':
            return 'This code does not apply to these courses.';
        default:
            return 'Invalid coupon';
    }
};
import { PlanTiles } from './PlanTiles';
import { pushCartViewed, pushCouponApplied } from '@/components/common/enroll-by-invite/-utils/gtm';
import { useCouponsEnabled } from '@/components/common/coupon/use-coupons-enabled';
import { Tag, X, ArrowLeft, ArrowRight, CheckCircle, SpinnerGap, ShoppingCartSimple } from "@phosphor-icons/react";
import type { ProductPageData, ProductPageSettings, PageJson } from '../-types/product-page-types';

function parseSafeJson<T>(jsonStr: string | null | undefined, fallback: T): T {
    if (!jsonStr) return fallback;
    try { return JSON.parse(jsonStr) as T; } catch { return fallback; }
}

const EMPTY_PAGE_JSON: PageJson = { globalSettings: { primaryColor: '#4F46E5', logoFileId: '' }, components: [] }; // design-lint-ignore: page-builder default color

interface CartStepProps {
    pageData: ProductPageData;
    settings: ProductPageSettings;
    primaryColor?: string;
    onBack: () => void;
    onNext: () => void;
}

/**
 * Cart step. The line items and running total live in CheckoutLayout's
 * OrderSummaryPanel, which stays on screen for the whole checkout — this step
 * owns only the decisions the visitor makes here: which plan, which coupon,
 * and what else to add.
 */
export const CartStep = ({ pageData, settings, primaryColor = '#2563eb', onBack, onNext }: CartStepProps) => { // design-lint-ignore: page-builder default color
    const {
        selectedPsOptionIds, couponCode, discountAmount,
        setCouponCode, applyCoupon, clearCoupon, totalPrice, toggleSelection, setSelection, utmParams,
    } = useProductPageStore();
    // Institute-level kill switch (admin Settings → Coupons → "Enable coupon redemption").
    // ANDed with the per-product-page settings.coupon.enabled flag below — both must be on.
    const instituteCouponsEnabled = useCouponsEnabled();

    const [couponInput, setCouponInput] = useState(couponCode);
    const [couponError, setCouponError] = useState('');
    const [couponSuccess, setCouponSuccess] = useState(!!couponCode && discountAmount > 0);

    const selectedMappings = pageData.mappings.filter((m) =>
        selectedPsOptionIds.includes(m.ps_invite_payment_option_id)
    );
    const currency = pageData.currency || selectedMappings[0]?.payment_plan?.currency || 'INR';
    const currencySymbol = currency === 'INR' ? '₹' : currency;

    const pageSuggestions = useMemo(
        () => parseSafeJson<PageJson>(pageData.page_json, EMPTY_PAGE_JSON).suggestions ?? {},
        [pageData.page_json]
    );
    // Include selected suggested courses too so the user can remove them via the suggestion card
    const suggestedIds = useMemo(() => [...new Set(
        selectedPsOptionIds.flatMap((id) => pageSuggestions[id] ?? [])
    )], [selectedPsOptionIds, pageSuggestions]);
    const suggestedMappings = useMemo(() => pageData.mappings.filter(
        (m) => suggestedIds.includes(m.ps_invite_payment_option_id) && m.status === 'ACTIVE'
    ), [pageData.mappings, suggestedIds]);

    const removeSuggested = (id: string) =>
        setSelection(selectedPsOptionIds.filter((sid) => sid !== id));

    const subtotal = totalPrice();
    const isEmpty = selectedPsOptionIds.length === 0;
    // Mirrors PlanTiles' own gate: it only shows when the page sells the same
    // thing several ways, which most pages do not.
    const planChoiceOffered =
        !!settings.planSelector?.enabled &&
        new Set(
            pageData.mappings
                .filter((m) => selectedPsOptionIds.includes(m.ps_invite_payment_option_id))
                .map((m) => m.payment_plan?.id)
                .filter(Boolean)
        ).size > 1;

    useEffect(() => {
        pushCartViewed(
            selectedMappings.map((m) => m.payment_plan?.name || m.ps_invite_payment_option_id),
            subtotal,
            utmParams,
        );
    }, []);

    // Cart changes invalidate the discount value computed for the previous
    // basket — the BE will recompute against the new subtotal at enroll time.
    // Drop the applied coupon and surface a gentle prompt so the learner
    // knows to re-apply for the updated cart.
    const prevCartKeyRef = useRef<string>(selectedPsOptionIds.slice().sort().join('|'));
    useEffect(() => {
        const currentKey = selectedPsOptionIds.slice().sort().join('|');
        if (prevCartKeyRef.current !== currentKey) {
            prevCartKeyRef.current = currentKey;
            if (couponCode && discountAmount > 0) {
                clearCoupon();
                setCouponInput('');
                setCouponSuccess(false);
                setCouponError('Cart changed — please re-apply your coupon.');
            }
        }
    }, [selectedPsOptionIds, couponCode, discountAmount, clearCoupon]);

    const couponMutation = useMutation({
        mutationFn: () =>
            validateCoupon(
                pageData.code,
                couponInput.trim(),
                subtotal,
                selectedPsOptionIds.length
            ),
        onSuccess: (data) => {
            if (!data.valid) {
                // The API answers in codes; a refused quantity condition needs to
                // say what would fix it, or the visitor just sees "invalid" on a
                // code that is perfectly real.
                setCouponError(couponMessage(data.message));
                setCouponSuccess(false);
                return;
            }
            applyCoupon(data.coupon_code_id, data.applied_coupon_discount_id, data.discount_value);
            setCouponCode(couponInput.trim());
            setCouponSuccess(true);
            setCouponError('');
            pushCouponApplied(couponInput.trim(), data.discount_value);
        },
        onError: () => {
            setCouponError('Failed to validate coupon. Please try again.');
            setCouponSuccess(false);
        },
    });

    const handleRemoveCoupon = () => {
        clearCoupon();
        setCouponInput('');
        setCouponSuccess(false);
        setCouponError('');
    };

    return (
        <div>
            <div className="space-y-6 px-5 py-6 sm:px-6">

                {/* ── Heading ────────────────────────────────────────── */}
                <div>
                    <h1 className="text-lg font-bold text-gray-900">Review your cart</h1>
                    <p className="mt-0.5 text-caption text-gray-500">
                        {/* PlanTiles renders nothing unless the page offers two or
                            more genuine alternatives, so promising a plan choice
                            leaves most pages telling the visitor to do something
                            that is not on screen. */}
                        {planChoiceOffered
                            ? 'Check your selection and pick the plan that suits you before continuing.'
                            : 'Check your selection before continuing.'}
                    </p>
                </div>

                {/* ── Empty state ────────────────────────────────────── */}
                {isEmpty && (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
                        <ShoppingCartSimple className="mx-auto mb-2 size-6 text-gray-400" aria-hidden="true" />
                        <p className="text-sm font-medium text-gray-700">Nothing in your cart yet</p>
                        <p className="mt-1 text-caption text-gray-500">
                            Go back and choose at least one course to continue.
                        </p>
                    </div>
                )}

                {/* ── Plan tiles — from the page's configured payment plans ─── */}
                <PlanTiles pageData={pageData} settings={settings} primaryColor={primaryColor} />

                {/* ── Coupon ─────────────────────────────────────────── */}
                {/* Gated by BOTH the per-page setting AND the institute-level toggle. */}
                {(settings.coupon?.enabled && instituteCouponsEnabled) && (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
                            <Tag className="size-4 text-gray-400" aria-hidden="true" />
                            <span className="text-caption font-semibold text-gray-700">Have a coupon code?</span>
                        </div>
                        <div className="px-4 py-4">
                            {couponSuccess ? (
                                <div className="flex items-center justify-between gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <CheckCircle className="size-4 shrink-0 text-success-600" aria-hidden="true" />
                                        <span className="truncate font-mono text-caption font-semibold text-success-700">{couponCode}</span>
                                        <span className="shrink-0 text-caption text-success-600">
                                            — {currencySymbol}{discountAmount.toLocaleString()} off
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRemoveCoupon}
                                        className="shrink-0 text-gray-400 transition-colors hover:text-danger-600"
                                        aria-label="Remove coupon"
                                    >
                                        <X className="size-4" aria-hidden="true" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Enter coupon code"
                                        value={couponInput}
                                        onChange={(e) => {
                                            setCouponInput(e.target.value.toUpperCase());
                                            setCouponError('');
                                        }}
                                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm uppercase placeholder:normal-case focus:border-primary-400 focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        disabled={!couponInput.trim() || couponMutation.isPending}
                                        onClick={() => couponMutation.mutate()}
                                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
                                    >
                                        {couponMutation.isPending ? <SpinnerGap className="size-4 animate-spin" aria-hidden="true" /> : 'Apply'}
                                    </button>
                                </div>
                            )}
                            {couponError && <p className="mt-2 text-caption text-danger-600">{couponError}</p>}
                        </div>
                    </div>
                )}

                {/* ── Suggested courses ──────────────────────────────── */}
                {(() => {
                    const showOn = settings.suggestedCourses?.showOn ?? 'BOTH';
                    const visible = settings.suggestedCourses?.enabled &&
                        (showOn === 'CART' || showOn === 'BOTH') &&
                        suggestedMappings.length > 0;
                    if (!visible) return null;
                    return (
                        <div>
                            <h2 className="mb-3 text-sm font-semibold text-gray-700">
                                {settings.suggestedCourses!.heading || 'People also buy'}
                            </h2>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {suggestedMappings.map((m) => {
                                    const plan = m.payment_plan;
                                    const isAdded = selectedPsOptionIds.includes(m.ps_invite_payment_option_id);
                                    const initials = (m.package_name || plan?.name || 'C')
                                        .trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                                    const label = m.package_name
                                        ? `${m.package_name}${m.session_name ? ` · ${m.session_name}` : ''}`
                                        : plan?.name || 'Course';
                                    return (
                                        <div
                                            key={m.ps_invite_payment_option_id}
                                            className="flex w-44 shrink-0 flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                                        >
                                            <div
                                                className="mb-2.5 flex size-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                                                // Dynamic: the institute's own page colour, only known at runtime.
                                                style={{ backgroundColor: primaryColor }}
                                            >
                                                {initials}
                                            </div>
                                            <p className="mb-1 line-clamp-2 flex-1 text-xs font-semibold leading-snug text-gray-900">{label}</p>
                                            <p className="mb-3 text-sm font-bold text-gray-900">
                                                {(plan?.actual_price ?? 0) > 0
                                                    ? `${currencySymbol}${plan!.actual_price.toLocaleString()}`
                                                    : 'Free'}
                                            </p>
                                            {isAdded ? (
                                                <button
                                                    type="button"
                                                    onClick={() => removeSuggested(m.ps_invite_payment_option_id)}
                                                    className="w-full rounded-lg border border-danger-400 py-1.5 text-xs font-semibold text-danger-600 transition-colors hover:opacity-80"
                                                >
                                                    − Remove
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSelection(m.ps_invite_payment_option_id)}
                                                    className="w-full rounded-lg border py-1.5 text-xs font-semibold transition-colors hover:opacity-80"
                                                    // Dynamic: institute page colour, see above.
                                                    style={{ borderColor: primaryColor, color: primaryColor }}
                                                >
                                                    + Add
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* ── Step navigation ────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:px-6">
                {!settings.disableBackNavigation ? (
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Previous
                    </button>
                ) : <div />}
                <button
                    type="button"
                    onClick={onNext}
                    disabled={isEmpty}
                    className="flex items-center gap-2 rounded-xl px-7 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    // Dynamic: institute page colour, see above.
                    style={{ backgroundColor: primaryColor }}
                >
                    Continue
                    <ArrowRight className="size-4" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
};
