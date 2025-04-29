package vacademy.io.assessment_service.features.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "assessment_registration_custom_field_response_data")
@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentRegistrationCustomFieldResponse {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne(cascade = CascadeType.DETACH)
    @JoinColumn(name = "custom_field_id")
    private AssessmentCustomField assessmentCustomField;

    @ManyToOne
    @JoinColumn(name = "assessment_registration_id")
    @JsonIgnore
    private AssessmentUserRegistration assessmentUserRegistration;

    @Column(name = "answer")
    private String answer;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}