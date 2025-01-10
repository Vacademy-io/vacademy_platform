package vacademy.io.assessment_service.features.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "assessment_batch_registration")
@Data
@EqualsAndHashCode(of = "id")
public class AssessmentBatchRegistration {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne
    @JoinColumn(name = "assessment_id")
    @JsonIgnore
    private Assessment assessment;

    @Column(name = "batch_id", nullable = false)
    private String batchId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "registration_time", nullable = false)
    private Date registrationTime;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}