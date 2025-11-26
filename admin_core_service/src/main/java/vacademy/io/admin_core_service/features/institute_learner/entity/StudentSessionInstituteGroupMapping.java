package vacademy.io.admin_core_service.features.institute_learner.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.entity.Group;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Date;

@Entity
@Table(name = "student_session_institute_group_mapping")
@Data
@NoArgsConstructor
public class StudentSessionInstituteGroupMapping {

    @Id
    @UuidGenerator
    @Column(name = "id", length = 255, nullable = false, updatable = false)
    private String id;

    @Column(name = "user_id", length = 255, nullable = false)
    private String userId;

    @Column(name = "institute_enrollment_number", length = 255)
    private String instituteEnrolledNumber;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "enrolled_date")
    private Date enrolledDate;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "expiry_date")
    private Date expiryDate;

    @Column(name = "status", length = 100)
    private String status;

    @CreationTimestamp
    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at")
    private Date updatedAt;

    // Relationships
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", referencedColumnName = "id")
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institute_id", referencedColumnName = "id")
    private Institute institute;

    @Column(name = "automated_completion_certificate_file_id", length = 255)
    private String automatedCompletionCertificateFileId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "package_session_id", referencedColumnName = "id")
    private PackageSession packageSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_package_session_id", referencedColumnName = "id")
    private PackageSession destinationPackageSession;

    @Column(name = "user_plan_id", length = 255)
    private String userPlanId;

    @Column(name = "type_id", length = 255)
    private String typeId;

    @Column(name = "type", length = 100)
    private String type;

    @Column(name = "source", length = 100)
    private String source;

    @Column(name = "desired_level_id")
    private String desiredLevelId;

    @Column(name = "desired_package_id", length = 255)
    private String desiredPackageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sub_org_id", referencedColumnName = "id")
    private Institute subOrg;

    @Column(name = "comma_separated_org_roles", columnDefinition = "TEXT")
    private String commaSeparatedOrgRoles;
}
