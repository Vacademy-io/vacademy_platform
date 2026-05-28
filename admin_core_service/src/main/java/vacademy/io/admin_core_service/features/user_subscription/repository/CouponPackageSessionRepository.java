package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponPackageSession;

import java.util.List;

@Repository
public interface CouponPackageSessionRepository extends JpaRepository<CouponPackageSession, String> {

    List<CouponPackageSession> findByCouponCodeId(String couponCodeId);

    boolean existsByCouponCodeIdAndPackageSessionId(String couponCodeId, String packageSessionId);

    @Modifying
    @Query("DELETE FROM CouponPackageSession c WHERE c.couponCodeId = :couponCodeId")
    void deleteByCouponCodeId(@Param("couponCodeId") String couponCodeId);
}
