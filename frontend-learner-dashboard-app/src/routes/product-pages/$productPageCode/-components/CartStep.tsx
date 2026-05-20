import { useState, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useProductPageStore } from '../-stores/product-page-store';
import { validateCoupon } from '../-services/product-page-service';
import { pushCartViewed, pushCouponApplied } from '@/components/common/enroll-by-invite/-utils/gtm';
import { Tag, X, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import type { ProductPageData, ProductPageSettings, PageJson } from '../-types/product-page-types';

function parseSafeJson<T>(jsonStr: string | null | undefined, fallback: T): T {
    if (!jsonStr) return fallback;
    try { return JSON.parse(jsonStr) as T; } catch { return fallback; }
}

const EMPTY_PAGE_JSON: PageJson = { globalSettings: { primaryColor: '#4F46E5', logoFileId: '' }, components: [] };

interface CartStepProps {
    pageData: ProductPageData;
    settings: ProductPageSettings;
    primaryColor?: string;
    onBack: () => void;
    onNext: () => void;
}

export const CartStep = ({ pageData, settings, primaryColor = '#2563eb', onBack, onNext }: CartStepProps) => {
    const {
        selectedPsOptionIds, couponCode, discountAmount,
        setCouponCode, applyCoupon, clearCoupon, totalPrice, finalPrice, toggleSelection, setSelection, utmParams,
    } = useProductPageStore();

    const removeFromCart = (id: string) =>
        setSelection(selectedPsOptionIds.filter((sid) => sid !== id));

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
    const allSuggestableIds = useMemo(() => new Set(Object.values(pageSuggestions).flat()), [pageSuggestions]);
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
    const finalAmt = finalPrice();
    const hasDiscount = discountAmount > 0;

    useEffect(() => {
        pushCartViewed(
            selectedMappings.map((m) => m.payment_plan?.name || m.ps_invite_payment_option_id),
            subtotal,
            utmParams,
        );
    }, []);

    const couponMutation = useMutation({
        mutationFn: () => validateCoupon(pageData.code, couponInput.trim(), subtotal),
        onSuccess: (data) => {
            if (!data.valid) {
                setCouponError(data.message || 'Invalid coupon');
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
        <div className="min-h-screen bg-gray-50 pb-24">
            <div className="px-4 py-6">
                <div className="mx-auto max-w-xl space-y-4">

                    {/* ── Order summary card ─────────────────────────────── */}
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

                        {/* Header */}
                        <div className="flex items-center gap-4 px-6 py-5">
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
                                <CheckCircle2 className="size-6 text-green-600" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Order Summary</h1>
                                <p className="mt-0.5 text-sm text-gray-500">
                                    Review your order before proceeding to payment
                                </p>
                            </div>
                        </div>

                        {/* Course items — compact rows */}
                        <div className="border-t border-gray-200">
                            {selectedMappings.map((mapping, idx) => {
                                const plan = mapping.payment_plan;
                                const nameParts = [mapping.package_name, mapping.level_name, mapping.session_name].filter(Boolean);
                                const courseName = nameParts.join(' | ') || plan?.name || `Course ${idx + 1}`;
                                const isSuggested = allSuggestableIds.has(mapping.ps_invite_payment_option_id);
                                const canRemove = isSuggested || settings.allowCourseDeselection;
                                const price = plan?.actual_price ?? 0;
                                const access = plan?.validity_in_days > 0
                                    ? plan.validity_in_days === 365 ? '1 yr'
                                        : plan.validity_in_days % 30 === 0 ? `${plan.validity_in_days / 30}mo`
                                        : `${plan.validity_in_days}d`
                                    : null;

                                return (
                                    <div
                                        key={mapping.ps_invite_payment_option_id}
                                        className={`flex items-start gap-3 px-5 py-3.5${idx > 0 ? ' border-t border-gray-100' : ''}`}
                                    >
                                        {/* Index badge */}
                                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                                            {idx + 1}
                                        </span>

                                        {/* Name + meta */}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold leading-snug text-gray-900">{courseName}</p>
                                            <p className="mt-0.5 text-xs text-gray-400">
                                                {plan?.name}{access ? ` · ${access}` : ''}
                                            </p>
                                        </div>

                                        {/* Price + remove */}
                                        <div className="flex shrink-0 items-center gap-2">
                                            {price > 0 ? (
                                                <span className="text-sm font-bold text-gray-900">
                                                    {currencySymbol}{price.toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold text-green-600">Free</span>
                                            )}
                                            {canRemove && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeFromCart(mapping.ps_invite_payment_option_id)}
                                                    className="flex size-5 items-center justify-center rounded-full text-gray-300 hover:bg-red-50 hover:text-red-400"
                                                    title="Remove"
                                                >
                                                    <X className="size-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Combined total (only when multiple items or coupon) */}
                        {(selectedMappings.length > 1 || hasDiscount) && (
                            <div className="border-t border-gray-100 px-6 py-4">
                                {selectedMappings.length > 1 && (
                                    <div className="mb-2 flex justify-between text-sm text-gray-500">
                                        <span>Subtotal ({selectedMappings.length} items)</span>
                                        <span>{currencySymbol}{subtotal.toLocaleString()}</span>
                                    </div>
                                )}
                                {hasDiscount && (
                                    <div className="mb-2 flex justify-between text-sm text-green-600">
                                        <span>Coupon ({couponCode})</span>
                                        <span>− {currencySymbol}{discountAmount.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-base font-bold text-gray-900">
                                    <span>Total</span>
                                    <span>{currencySymbol}{finalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Coupon card ────────────────────────────────────── */}
                    {(settings.coupon?.enabled) && <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
                            <Tag className="size-4 text-gray-400" />
                            <span className="text-sm font-semibold text-gray-700">Coupon Code</span>
                        </div>
                        <div className="px-5 py-4">
                            {couponSuccess ? (
                                <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="size-4 text-green-600" />
                                        <span className="font-mono text-sm font-semibold text-green-800">{couponCode}</span>
                                        <span className="text-sm text-green-700">
                                            — {currencySymbol}{discountAmount.toLocaleString()} off
                                        </span>
                                    </div>
                                    <button type="button" onClick={handleRemoveCoupon} className="text-gray-400 hover:text-red-500">
                                        <X className="size-4" />
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
                                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm uppercase placeholder:normal-case focus:border-blue-500 focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        disabled={!couponInput.trim() || couponMutation.isPending}
                                        onClick={() => couponMutation.mutate()}
                                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
                                    >
                                        {couponMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Apply'}
                                    </button>
                                </div>
                            )}
                            {couponError && <p className="mt-2 text-xs text-red-600">{couponError}</p>}
                        </div>
                    </div>}

                    {/* ── Suggested courses ─────────────────────────────── */}
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
                                                        className="w-full rounded-lg border border-red-400 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:opacity-80"
                                                    >
                                                        − Remove
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSelection(m.ps_invite_payment_option_id)}
                                                        className="w-full rounded-lg border py-1.5 text-xs font-semibold transition-colors hover:opacity-80"
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
            </div>

            {/* ── Bottom navigation — fixed to viewport bottom ────────── */}
            <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white px-4 py-4">
                <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
                    {!settings.disableBackNavigation ? (
                        <button
                            type="button"
                            onClick={onBack}
                            className="flex items-center gap-2 rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                        >
                            <ArrowLeft className="size-4" />
                            Previous
                        </button>
                    ) : <div />}
                    <button
                        type="button"
                        onClick={onNext}
                        className="flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: primaryColor }}
                    >
                        Next
                        <ArrowRight className="size-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
