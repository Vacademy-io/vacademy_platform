package vacademy.io.notification_service.features.firebase_notifications.repository;
import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.notification_service.features.firebase_notifications.entity.FcmToken;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface FcmTokenRepository extends JpaRepository<FcmToken, String> {

    List<FcmToken> findByUserIdAndIsActiveTrue(String userId);

    List<FcmToken> findByUserIdAndInstituteIdAndIsActiveTrue(String userId, String instituteId);

    Optional<FcmToken> findByTokenAndIsActiveTrue(String token);

    Optional<FcmToken> findByUserIdAndDeviceIdAndIsActiveTrue(String userId, String deviceId);

    @Modifying
    @Transactional
    @Query("UPDATE FcmToken f SET f.isActive = false WHERE f.userId = :userId AND f.deviceId = :deviceId")
    void deactivateTokenByUserIdAndDeviceId(@Param("userId") String userId, @Param("deviceId") String deviceId);

    @Modifying
    @Transactional
    @Query("UPDATE FcmToken f SET f.isActive = false WHERE f.token = :token")
    void deactivateTokenByToken(@Param("token") String token);

    List<FcmToken> findByIsActiveTrue();

    List<FcmToken> findByInstituteIdAndIsActiveTrue(String instituteId);
}