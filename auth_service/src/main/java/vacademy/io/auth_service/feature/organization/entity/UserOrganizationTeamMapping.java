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

    /**
     * The user this person reports to INSIDE this team. NULL means top of
     * the team (no manager). Added in V13. The same user can have different
     * parent_user_ids in different teams.
     */
    @Column(name = "parent_user_id")
    private String parentUserId;

    /**
     * Legacy column. We no longer read or write it — system role is pulled
     * fresh from the user record on each render so role changes propagate
     * automatically. But the column is NOT NULL so we default to "MEMBER"
     * on every INSERT to satisfy the constraint without bothering the
     * service layer.
     */
    @Column(name = "role_name", nullable = false, length = 100)
    @Builder.Default
    private String roleName = "MEMBER";

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

    /** Stamp updated_at on insert too — column is NOT NULL in V12 and
     *  Hibernate sends every mapped field, so DEFAULT NOW() never fires. */
    @PrePersist
    protected void onCreate() {
        if (updatedAt == null) updatedAt = new Timestamp(System.currentTimeMillis());
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}
