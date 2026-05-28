package vacademy.io.admin_core_service.features.user_subscription.service.coupon;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;
import vacademy.io.admin_core_service.features.user_subscription.repository.CouponCodeRepository;
import vacademy.io.common.exceptions.VacademyException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The atomic decrement contract — exercises every short-circuit, the
 * status-flip mid-flight rejection, and the apply-time race-loss path.
 */
@ExtendWith(MockitoExtension.class)
class CouponRedemptionServiceTest {

    @Mock
    private CouponCodeRepository couponCodeRepository;

    @InjectMocks
    private CouponRedemptionService service;

    private CouponCode coupon;
    private AppliedCouponDiscount discount;

    @BeforeEach
    void setUp() {
        coupon = new CouponCode();
        coupon.setId("coupon-1");
        coupon.setCode("SAVE20");
        coupon.setStatus("ACTIVE");

        discount = new AppliedCouponDiscount();
        discount.setId("acd-1");
        discount.setCouponCode(coupon);
    }

    @Test
    @DisplayName("Null discount is a no-op")
    void nullDiscount() {
        service.consume(null);
        verify(couponCodeRepository, never()).tryDecrementUsageLimit(anyString());
    }

    @Test
    @DisplayName("Discount with null couponCode is a no-op (defensive)")
    void discountWithNullCoupon() {
        AppliedCouponDiscount orphan = new AppliedCouponDiscount();
        orphan.setCouponCode(null);

        service.consume(orphan);

        verify(couponCodeRepository, never()).tryDecrementUsageLimit(anyString());
    }

    @Test
    @DisplayName("Unlimited coupon (usageLimit == null) skips the decrement")
    void unlimitedSkipsDecrement() {
        coupon.setUsageLimit(null);

        service.consume(discount);

        verify(couponCodeRepository, never()).tryDecrementUsageLimit(anyString());
    }

    @Test
    @DisplayName("Bounded coupon decrements via the atomic update")
    void boundedDecrement() {
        coupon.setUsageLimit(5L);
        when(couponCodeRepository.tryDecrementUsageLimit("coupon-1")).thenReturn(1);

        service.consume(discount);

        verify(couponCodeRepository).tryDecrementUsageLimit("coupon-1");
    }

    @Test
    @DisplayName("Status flipped to INACTIVE between validate and apply → throws COUPON_INACTIVE")
    void statusFlippedMidFlight() {
        coupon.setStatus("INACTIVE");

        VacademyException ex = assertThrows(VacademyException.class, () -> service.consume(discount));

        assertEquals(CouponValidationMessages.INACTIVE, ex.getMessage());
        verify(couponCodeRepository, never()).tryDecrementUsageLimit(anyString());
    }

    @Test
    @DisplayName("Status flipped to DELETED → throws COUPON_INACTIVE")
    void deletedMidFlight() {
        coupon.setStatus("DELETED");

        VacademyException ex = assertThrows(VacademyException.class, () -> service.consume(discount));

        assertEquals(CouponValidationMessages.INACTIVE, ex.getMessage());
    }

    @Test
    @DisplayName("Race-loss (atomic update affected 0 rows) → throws COUPON_LIMIT_REACHED")
    void raceLossThrowsLimitReached() {
        coupon.setUsageLimit(1L);
        when(couponCodeRepository.tryDecrementUsageLimit("coupon-1")).thenReturn(0);

        VacademyException ex = assertThrows(VacademyException.class, () -> service.consume(discount));

        assertEquals(CouponValidationMessages.LIMIT_REACHED, ex.getMessage());
    }
}
