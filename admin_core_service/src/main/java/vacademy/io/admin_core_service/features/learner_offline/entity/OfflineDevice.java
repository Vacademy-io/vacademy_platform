package vacademy.io.admin_core_service.features.learner_offline.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDeviceStatus;

import java.sql.Timestamp;

/**
 * A learner's registered offline device (offline plan, Part A3). Encryption
 * keys are device-local (Keychain/Keystore) and never recorded here -- this
 * row exists only to cap concurrent ACTIVE devices per learner and to carry
 * revocation state that OfflineCheckInService turns into a client-side purge.
 * Re-registering the same physical device (matched by clientDeviceId)
 * reactivates this row instead of consuming a new device slot -- see
 * OfflineDeviceService.register().
 */
@Entity
@Table(name = "offline_device")
@Getter
@Setter
@NoArgsConstructor
public class OfflineDevice {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "device_name")
    private String deviceName;

    @Column(name = "platform")
    private String platform;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private OfflineDeviceStatus status;

    /** Stable Capacitor {@code Device.getId()} value reported by the client. */
    @Column(name = "client_device_id", nullable = false)
    private String clientDeviceId;

    @Column(name = "lease_expires_at")
    private Timestamp leaseExpiresAt;

    @Column(name = "last_checkin_at")
    private Timestamp lastCheckinAt;

    @Column(name = "registered_at")
    private Timestamp registeredAt;

    @Column(name = "revoked_at")
    private Timestamp revokedAt;

    @Column(name = "revoked_by_user_id")
    private String revokedByUserId;

    @Column(name = "revoke_reason", length = 64)
    private String revokeReason;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
