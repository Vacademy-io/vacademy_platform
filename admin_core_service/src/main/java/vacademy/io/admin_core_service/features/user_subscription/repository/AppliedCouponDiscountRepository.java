package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode; // Import CouponCode

import java.util.List;
import java.util.Optional;

@Repository
public interface AppliedCouponDiscountRepository extends JpaRepository<AppliedCouponDiscount, String> {

    @Query("""
        select acd
        from AppliedCouponDiscount acd
        join acd.couponCode cc
        where cc.sourceId = :sourceId
          and cc.sourceType = :sourceType
          and cc.tag = :tag
          and (:couponStatuses is null or cc.status in :couponStatuses)
          and (:appliedStatuses is null or acd.status in :appliedStatuses)
    """)
    Optional<AppliedCouponDiscount> findAppliedDiscountBySourceAndTag(
            @Param("sourceId") String sourceId,
            @Param("sourceType") String sourceType,
            @Param("tag") String tag,
            @Param("couponStatuses") List<String> couponStatuses,
            @Param("appliedStatuses") List<String> appliedStatuses
    );
}