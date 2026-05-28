package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponEnrollInvite;

import java.util.List;

@Repository
public interface CouponEnrollInviteRepository extends JpaRepository<CouponEnrollInvite, String> {

    List<CouponEnrollInvite> findByCouponCodeId(String couponCodeId);

    boolean existsByCouponCodeIdAndEnrollInviteId(String couponCodeId, String enrollInviteId);

    @Modifying
    @Query("DELETE FROM CouponEnrollInvite c WHERE c.couponCodeId = :couponCodeId")
    void deleteByCouponCodeId(@Param("couponCodeId") String couponCodeId);
}
