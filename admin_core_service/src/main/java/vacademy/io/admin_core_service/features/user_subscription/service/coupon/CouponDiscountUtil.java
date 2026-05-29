package vacademy.io.admin_core_service.features.user_subscription.service.coupon;

import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;

/**
 * Shared discount math, extracted from ProductPageService.computeDiscount so
 * the new CouponValidationService and the legacy product-page path produce
 * identical numbers. Accepts case-insensitive "PERCENTAGE" / "percentage";
 * any other discountType is treated as a flat amount.
 */
public final class CouponDiscountUtil {

    public static final String TYPE_PERCENTAGE = "PERCENTAGE";
    public static final String TYPE_FLAT = "FLAT";

    private CouponDiscountUtil() {}

    public static double computeDiscount(AppliedCouponDiscount discount, double totalAmount) {
        if (discount == null || discount.getDiscountPoint() == null) {
            return 0.0;
        }
        String type = discount.getDiscountType();
        if (type != null && "percentage".equalsIgnoreCase(type)) {
            double computed = totalAmount * discount.getDiscountPoint() / 100.0;
            if (discount.getMaxDiscountPoint() != null && computed > discount.getMaxDiscountPoint()) {
                return discount.getMaxDiscountPoint();
            }
            return computed;
        }
        return discount.getDiscountPoint();
    }

    /**
     * Returns the amount the payment gateway should actually capture for an
     * enrollment after the validated coupon discount is applied. Null base or
     * null discount → base passed through unchanged. Floors at 0 so a flat
     * discount larger than the price (or a 100%+ percentage coupon) collapses
     * to zero instead of going negative — callers should treat a zero result
     * as "skip the gateway, mark as paid".
     *
     * The result is rounded to 2 decimal places (currency precision) so the
     * gateway sees a clean amount and downstream telemetry doesn't trip on
     * floating-point noise. Stripe/Razorpay both expect 2dp amounts anyway.
     */
    public static double applyDiscount(Double baseAmount, AppliedCouponDiscount discount) {
        if (baseAmount == null) return 0.0;
        if (discount == null) return roundCurrency(baseAmount);
        double net = Math.max(0.0, baseAmount - computeDiscount(discount, baseAmount));
        return roundCurrency(net);
    }

    private static double roundCurrency(double amount) {
        return Math.round(amount * 100.0) / 100.0;
    }
}
