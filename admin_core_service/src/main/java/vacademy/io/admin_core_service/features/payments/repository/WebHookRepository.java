package vacademy.io.admin_core_service.features.payments.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.payments.entity.WebHook;
import vacademy.io.admin_core_service.features.payments.enums.WebHookStatus;

import java.time.LocalDateTime;
import java.util.List;

public interface WebHookRepository extends JpaRepository<WebHook, String> {
    @Query("SELECT w FROM WebHook w " +
        "WHERE w.createdAt BETWEEN :startTime AND :endTime " +
        "AND w.status = :status " +
        "AND w.vendor = :vendor")
    List<WebHook> findByCreatedAtBetweenAndStatusAndVendor(
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime,
        @Param("status") WebHookStatus status,
        @Param("vendor") String vendor);
}
