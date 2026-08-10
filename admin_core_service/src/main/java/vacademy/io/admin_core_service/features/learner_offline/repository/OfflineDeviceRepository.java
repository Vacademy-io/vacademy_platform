package vacademy.io.admin_core_service.features.learner_offline.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineDevice;

import java.util.List;
import java.util.Optional;

@Repository
public interface OfflineDeviceRepository extends JpaRepository<OfflineDevice, String> {

    Optional<OfflineDevice> findByUserIdAndClientDeviceId(String userId, String clientDeviceId);

    Optional<OfflineDevice> findByIdAndUserId(String id, String userId);

    List<OfflineDevice> findByUserIdAndInstituteIdOrderByRegisteredAtDesc(String userId, String instituteId);

    /** Admin cross-institute device listing for a given user. */
    List<OfflineDevice> findByUserIdOrderByRegisteredAtDesc(String userId);

    /**
     * Pessimistic-locked read of a user's ACTIVE devices, used inside
     * OfflineDeviceService.register()'s transaction to serialize concurrent
     * registrations so the max-devices cap can't be raced past.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT d FROM OfflineDevice d
            WHERE d.userId = :userId
              AND d.status = vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDeviceStatus.ACTIVE
            """)
    List<OfflineDevice> findActiveForUpdateByUserId(@Param("userId") String userId);
}
