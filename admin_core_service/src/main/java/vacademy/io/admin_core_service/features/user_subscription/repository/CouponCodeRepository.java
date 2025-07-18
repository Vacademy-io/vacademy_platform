package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;

import java.util.Optional; // Added for findByCode

@Repository
public interface CouponCodeRepository extends JpaRepository<CouponCode, String> {
    // Example: Find a coupon code by its actual code string
    Optional<CouponCode> findByCode(String code);

    // Example: Find active coupon codes
    // List<CouponCode> findByStatus(String status);
}