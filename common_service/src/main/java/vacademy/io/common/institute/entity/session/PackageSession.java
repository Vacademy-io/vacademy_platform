package vacademy.io.common.institute.entity.session;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.entity.Group;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;

import java.util.Date;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "package_session")

public class PackageSession {

    @Id
    @Column(name = "id")
    @UuidGenerator
    private String id;

    @JoinColumn(name = "level_id")
    @ManyToOne
    private Level level;

    @JoinColumn(name = "session_id")
    @ManyToOne
    private Session session;

    @Column(name = "start_time")
    private Date startTime;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "status")
    private String status;

    @JoinColumn(name = "package_id")
    @ManyToOne
    private PackageEntity packageEntity;

    @JoinColumn(name = "group_id")
    @ManyToOne
    private Group group;

    /**
     * Optional human-readable name for this batch / subgroup.
     * Used when courses have subgroups under the same level + session.
     */
    @Column(name = "name")
    private String name;

    @Column(name = "is_org_associated")
    private Boolean isOrgAssociated;

    @Column(name = "enrollment_policy_settings")
    private String enrollmentPolicySettings;

    @Column(name = "available_slots")
    private Integer availableSlots;

    @Column(name = "max_seats")
    private Integer maxSeats;

    /**
     * Whether this batch is a parent batch (has child batches).
     * Optional; backward compatible: null treated as false.
     */
    @Column(name = "is_parent")
    private Boolean isParent;

    /**
     * ID of the parent batch if this is a child batch. Optional.
     */
    @Column(name = "parent_id")
    private String parentId;

    /**
     * Content-copy lineage (audit). Set by the wizard-time copy-content flow.
     * - "VALUE"     => the content tree under this batch was deep-cloned from another batch.
     * - "REFERENCE" => the content tree under this batch is shared (by mapping rows) with another batch.
     * - null        => batch was not seeded via copy-content (the default).
     */
    @Column(name = "content_copied_by")
    private String contentCopiedBy;

    /**
     * Source package_session.id this batch's content was seeded from. Null when
     * {@link #contentCopiedBy} is null. Not a foreign key — kept as a plain id
     * so the audit trail survives deletion of the source batch.
     */
    @Column(name = "content_copied_from_package_session_id")
    private String contentCopiedFromPackageSessionId;

    @Version
    private Long version;

    @PrePersist
    public void prePersist() {
        if (isOrgAssociated == null) {
            isOrgAssociated = false;
        }
        if (isParent == null) {
            isParent = false;
        }
    }
}
