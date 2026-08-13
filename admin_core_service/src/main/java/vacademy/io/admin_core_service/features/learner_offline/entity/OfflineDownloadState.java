package vacademy.io.admin_core_service.features.learner_offline.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * Latest reported download state of one slide on one offline device (offline
 * plan, Part A5). Fed by DOWNLOAD_STATE events through the offline-sync
 * batch endpoint; UNIQUE(device_id, slide_id) is the upsert key -- see
 * OfflineDownloadStateService.
 */
@Entity
@Table(name = "offline_download_state")
@Getter
@Setter
@NoArgsConstructor
public class OfflineDownloadState {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "device_id", nullable = false)
    private String deviceId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "package_session_id")
    private String packageSessionId;

    @Column(name = "slide_id", nullable = false)
    private String slideId;

    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "client_ts")
    private Timestamp clientTs;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;
}
