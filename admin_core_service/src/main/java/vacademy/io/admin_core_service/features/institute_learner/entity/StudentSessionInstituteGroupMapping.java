package vacademy.io.admin_core_service.features.institute_learner.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
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
    @Column(name = "id", length = 255)
    @UuidGenerator
    private String id; // Assuming you want to have a unique ID for this mapping

    @Column(name = "user_id", length = 255)
    private String userId;

    @Column(name = "institute_enrollment_number")
    private String instituteEnrolledNumber;

    @Column(name = "enrolled_date")
    private Date enrolledDate;

    @Column(name = "expiry_date")
    private Date expiryDate;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    // Relationships with other entities
    @ManyToOne
    @JoinColumn(name = "group_id", referencedColumnName = "id")
    private Group group; // Assuming you have a Group entity defined

    @ManyToOne
    @JoinColumn(name = "institute_id", referencedColumnName = "id")
    private Institute institute; // Assuming you have an Institute entity defined

    @Column(name = "automated_completion_certificate_file_id")
    private String automatedCompletionCertificateFileId;

    @ManyToOne
    @JoinColumn(name = "package_session_id", referencedColumnName = "id")
    private PackageSession packageSession; // Assuming you have a PackageSession entity defined

    @ManyToOne
    @JoinColumn(name = "destination_package_session_id", referencedColumnName = "id")
    private PackageSession destinationPackageSession;

    @Column(name = "user_plan_id")
    private String userPlanId;

}