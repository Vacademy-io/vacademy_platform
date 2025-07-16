package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode; // Import CouponCode

import java.util.List;

@Repository
public interface AppliedCouponDiscountRepository extends JpaRepository<AppliedCouponDiscount, String> {
    // Example: Find applied discounts by their discount type
    List<AppliedCouponDiscount> findByDiscountType(String discountType);

    // Example: Find applied discounts associated with a specific coupon code
    // List<AppliedCouponDiscount> findByCouponCode(CouponCode couponCode);
}