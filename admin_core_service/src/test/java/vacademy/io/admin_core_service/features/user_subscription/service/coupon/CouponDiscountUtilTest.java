package vacademy.io.admin_core_service.features.user_subscription.service.coupon;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Pure math: makes sure PERCENTAGE/FLAT computations stay aligned with the
 * legacy ProductPageService.computeDiscount semantics after the extraction.
 */
class CouponDiscountUtilTest {

    private static AppliedCouponDiscount discount(String type, Double point, Double max) {
        AppliedCouponDiscount d = new AppliedCouponDiscount();
        d.setDiscountType(type);
        d.setDiscountPoint(point);
        d.setMaxDiscountPoint(max);
        return d;
    }

    @Nested
    @DisplayName("Percentage discounts")
    class Percentage {

        @Test
        @DisplayName("20% of 1000 = 200 when uncapped")
        void uncappedPercentage() {
            double v = CouponDiscountUtil.computeDiscount(discount("PERCENTAGE", 20.0, null), 1000.0);
            assertEquals(200.0, v);
        }

        @Test
        @DisplayName("Percentage cap kicks in when computed exceeds max")
        void cappedPercentage() {
            // 50% of 10000 = 5000, but max is 1000 → cap to 1000
            double v = CouponDiscountUtil.computeDiscount(discount("PERCENTAGE", 50.0, 1000.0), 10000.0);
            assertEquals(1000.0, v);
        }

        @Test
        @DisplayName("Percentage cap is ignored when computed is below max")
        void uncappedBelowMax() {
            // 10% of 1000 = 100, max is 500 → no cap
            double v = CouponDiscountUtil.computeDiscount(discount("PERCENTAGE", 10.0, 500.0), 1000.0);
            assertEquals(100.0, v);
        }

        @Test
        @DisplayName("Lowercase 'percentage' is accepted (legacy product-page rows)")
        void caseInsensitivePercentage() {
            double v = CouponDiscountUtil.computeDiscount(discount("percentage", 20.0, null), 500.0);
            assertEquals(100.0, v);
        }
    }

    @Nested
    @DisplayName("Flat discounts")
    class Flat {

        @Test
        @DisplayName("FLAT returns the discount point verbatim")
        void flatDiscount() {
            double v = CouponDiscountUtil.computeDiscount(discount("FLAT", 250.0, null), 1000.0);
            assertEquals(250.0, v);
        }

        @Test
        @DisplayName("Any non-percentage type is treated as flat")
        void unknownTypeIsFlat() {
            // Defensive: the historical product-page DTO sends 'FIXED' — backwards compat
            double v = CouponDiscountUtil.computeDiscount(discount("FIXED", 99.0, null), 500.0);
            assertEquals(99.0, v);
        }
    }

    @Nested
    @DisplayName("Degenerate inputs")
    class Degenerate {

        @Test
        @DisplayName("Null discount → 0")
        void nullDiscount() {
            assertEquals(0.0, CouponDiscountUtil.computeDiscount(null, 1000.0));
        }

        @Test
        @DisplayName("Null discountPoint → 0")
        void nullPoint() {
            assertEquals(0.0, CouponDiscountUtil.computeDiscount(discount("PERCENTAGE", null, 100.0), 1000.0));
        }

        @Test
        @DisplayName("Zero total amount on PERCENTAGE → 0")
        void zeroAmount() {
            assertEquals(0.0, CouponDiscountUtil.computeDiscount(discount("PERCENTAGE", 20.0, 100.0), 0.0));
        }
    }
}
