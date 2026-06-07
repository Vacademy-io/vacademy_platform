package vacademy.io.auth_service.feature.organization.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * A node in the institute's organization chart. Self-referential via
 * parent_id: a row with parent_id = NULL is a top-level vertical (Sales,
 * Engineering, …); everything below is a sub-team in the same vertical.
 *
 * Hierarchy traversal (ancestors / descendants) is done through recursive
 * CTEs in the repository layer — see OrganizationTeamRepository.
 */
@Entity
@Table(name = "organization_team")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrganizationTeam {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /** NULL for root verticals. FK to organization_team.id. */
    @Column(name = "parent_id")
    private String parentId;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * Convenience pointer to the user who heads this team. Kept in sync by
     * OrganizationTeamService whenever is_team_head changes on any mapping.
     */
    @Column(name = "head_user_id")
    private String headUserId;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    /** Sibling ordering for the chart UI. Lower = earlier. */
    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}
