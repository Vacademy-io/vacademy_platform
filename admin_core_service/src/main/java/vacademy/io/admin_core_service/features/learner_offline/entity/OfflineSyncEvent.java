package vacademy.io.admin_core_service.features.learner_offline.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.sql.Timestamp;

/**
 * Dedup ledger row for one offline-sync batch event (offline plan, Part A4).
 * The primary key IS the client-generated clientEventId -- that is what
 * makes a retried batch idempotent (see OfflineSyncEventProcessor's
 * INSERT ... ON CONFLICT (client_event_id) DO NOTHING).
 */
@Entity
@Table(name = "offline_sync_event")
@Getter
@Setter
@NoArgsConstructor
public class OfflineSyncEvent {

    @Id
    @Column(name = "client_event_id", nullable = false, updatable = false)
    private String clientEventId;

    @Column(name = "device_id", nullable = false)
    private String deviceId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "seq")
    private Long seq;

    @Column(name = "client_ts")
    private Timestamp clientTs;

    @Column(name = "event_type", nullable = false, length = 32)
    private String eventType;

    @Column(name = "slide_id")
    private String slideId;

    @Column(name = "package_session_id")
    private String packageSessionId;

    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "processed_at")
    private Timestamp processedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;
}
