package vacademy.io.admin_core_service.features.admission.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.UpdateTimestamp;

import java.util.Date;
import java.util.UUID;

@Entity
@Table(name = "admission_pipeline")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdmissionPipeline {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(
            name = "UUID",
            strategy = "org.hibernate.id.UUIDGenerator"
    )
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "package_session_id")
    private String packageSessionId;

    @Column(name = "parent_user_id")
    private String parentUserId;

    @Column(name = "child_user_id")
    private String childUserId;

    @Column(name = "enquiry_id")
    private String enquiryId;

    @Column(name = "applicant_id")
    private String applicantId;

    @Column(name = "lead_status", nullable = false)
    private String leadStatus; // ENQUIRY, APPLICATION, ADMITTED

    @Column(name = "source_type")
    private String sourceType;

    @Column(name = "enquiry_date")
    @Temporal(TemporalType.TIMESTAMP)
    private Date enquiryDate;

    @Column(name = "application_date")
    @Temporal(TemporalType.TIMESTAMP)
    private Date applicationDate;

    @Column(name = "admission_date")
    @Temporal(TemporalType.TIMESTAMP)
    private Date admissionDate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
