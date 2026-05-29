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
}
