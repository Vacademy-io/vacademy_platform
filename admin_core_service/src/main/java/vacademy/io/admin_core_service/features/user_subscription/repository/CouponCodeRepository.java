package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;

import java.util.List;
import java.util.Optional;

@Repository
public interface CouponCodeRepository extends JpaRepository<CouponCode, String> {
    // Find a coupon code by its actual code string
    Optional<CouponCode> findByCode(String code);

    // Find coupon codes by source ID and source type
    List<CouponCode> findBySourceIdAndSourceType(String sourceId, String sourceType);

    // Find the first coupon code by source ID and source type, ordered by creation date descending
    Optional<CouponCode> findFirstBySourceIdAndSourceTypeOrderByCreatedAtDesc(String sourceId, String sourceType);

    // Find active coupon codes
    List<CouponCode> findByStatus(String status);
}