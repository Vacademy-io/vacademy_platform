package vacademy.io.admin_core_service.features.learner_offline.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.sql.Timestamp;

/**
 * Current manifest version for a package session. The learner client stores
 * the last-seen version and re-fetches/diffs the manifest on mismatch. Bumped
 * atomically by OfflineManifestVersionService.bump() — never write this
 * entity directly outside that service.
 */
@Entity
@Table(name = "offline_manifest_version")
@Getter
@Setter
@NoArgsConstructor
public class OfflineManifestVersion {

    @Id
    @Column(name = "package_session_id", nullable = false, updatable = false)
    private String packageSessionId;

    @Column(name = "version", nullable = false)
    private Long version;

    @Column(name = "last_reason")
    private String lastReason;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
