package vacademy.io.admin_core_service.features.learner_offline.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineSourceType;

import java.sql.Timestamp;

/**
 * One explicit offline-download allow/block rule at a single content node.
 * Absence of a row = inherit — see OfflineAccessResolver for how a chain of
 * these rules resolves to a final allowed/blocked decision.
 */
@Entity
@Table(name = "offline_access_rule")
@Getter
@Setter
@NoArgsConstructor
public class OfflineAccessRule {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 32)
    private OfflineSourceType sourceType;

    @Column(name = "source_id", nullable = false)
    private String sourceId;

    /** NULL only for PACKAGE-level rules; mirrors source_id for PACKAGE_SESSION rules. */
    @Column(name = "package_session_id")
    private String packageSessionId;

    @Column(name = "allow", nullable = false)
    private Boolean allow;

    @Column(name = "created_by_user_id")
    private String createdByUserId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
