package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "assessment_registration_custom_field_response_data")
@Data
public class AssessmentRegistrationCustomFieldResponse {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne
    @JoinColumn(name = "custom_field_id")
    private AssessmentCustomField assessmentCustomField;

    @ManyToOne
    @JoinColumn(name = "assessment_registration_id")
    private AssessmentRegistration assessmentRegistration;

    @Column(name = "answer")
    private String answer;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}