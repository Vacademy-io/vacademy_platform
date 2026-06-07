package vacademy.io.auth_service.feature.organization.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * Per-(team, user) row. A user may belong to multiple teams; in each they
 * carry a system role_name (ADMIN / TEACHER / COUNSELLOR — never STUDENT,
 * enforced at the service layer) and an optional role_label which is the
 * human-readable title shown in the org chart (e.g. "Org Head" for ADMIN).
 *
 * Exactly one mapping per team can have is_team_head=TRUE (partial unique
 * index in V12).
 */
@Entity
@Table(name = "user_organization_team_mapping")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserOrganizationTeamMapping {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "team_id", nullable = false)
    private String teamId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "role_name", nullable = false, length = 100)
    private String roleName;

    /** Per-mapping UI label. NULL means the UI falls back to role_name. */
    @Column(name = "role_label", length = 100)
    private String roleLabel;

    @Column(name = "is_team_head", nullable = false)
    @Builder.Default
    private Boolean isTeamHead = false;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "added_by")
    private String addedBy;

    @Column(name = "added_at", insertable = false, updatable = false)
    private Timestamp addedAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}
