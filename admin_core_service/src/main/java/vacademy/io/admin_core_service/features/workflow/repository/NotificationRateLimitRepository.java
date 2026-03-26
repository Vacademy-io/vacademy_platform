package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.workflow.entity.NotificationRateLimit;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRateLimitRepository extends JpaRepository<NotificationRateLimit, UUID> {
    Optional<NotificationRateLimit> findByInstituteIdAndChannel(String instituteId, String channel);

    @Modifying
    @Query("UPDATE NotificationRateLimit r SET r.dailyUsed = r.dailyUsed + 1 WHERE r.id = :id AND r.dailyUsed < r.dailyLimit")
    int incrementUsage(@Param("id") UUID id);

    @Modifying
    @Query("UPDATE NotificationRateLimit r SET r.dailyUsed = 0, r.resetDate = :today WHERE r.resetDate < :today")
    int resetExpiredCounters(@Param("today") LocalDate today);
}
