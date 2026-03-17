package vacademy.io.admin_core_service.features.enquiry.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.sql.Timestamp;
import java.util.UUID;

/**
 * Entity representing a customer enquiry
 * Stores enquiry details with tracking information
 */
@Entity
@Table(name = "enquiry")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Enquiry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, unique = true)
    private UUID id;

    @Column(name = "checklist", columnDefinition = "TEXT")
    private String checklist; // JSON structure for checklist items

    @Column(name = "enquiry_status", length = 50)
    private String enquiryStatus;

    @Column(name = "convertion_status")
    private String convertionStatus;

    @Column(name = "reference_source")
    private String referenceSource;

    @Column(name = "assigned_user_id")
    private Boolean assignedUserId;

    @Column(name = "assigned_visit_session_id")
    private Boolean assignedVisitSessionId;

    @Column(name = "fee_range_expectation")
    private String feeRangeExpectation;

    @Column(name = "transport_requirement")
    private String transportRequirement;

    @Column(name = "mode", length = 50)
    private String mode;

    @Column(name = "enquiry_tracking_id")
    private String enquiryTrackingId;

    @Column(name = "interest_score")
    private Integer interestScore;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
