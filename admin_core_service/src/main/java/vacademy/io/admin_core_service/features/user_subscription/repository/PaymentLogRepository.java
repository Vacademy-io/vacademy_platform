package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;

import java.util.List;

@Repository
public interface PaymentLogRepository extends JpaRepository<PaymentLog, String> {

    @Query("SELECT pl FROM PaymentLog pl WHERE pl.userPlan.id = :userPlanId ORDER BY pl.createdAt DESC")
    List<PaymentLog> findByUserPlanIdOrderByCreatedAtDesc(@Param("userPlanId") String userPlanId);
}