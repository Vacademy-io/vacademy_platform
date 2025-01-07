package vacademy.io.assessment_service.features.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;
import java.util.List;

@Entity
@Table(name = "assessment_user_registration")
@Getter
@Setter
@EqualsAndHashCode(of = "id")
public class AssessmentUserRegistration {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne
    @JoinColumn(name = "assessment_id")
    @JsonIgnore
    private Assessment assessment;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "user_email", nullable = false)
    private String userEmail;

    @Column(name = "username", nullable = false)
    private String username;

    @Column(name = "phone_number", nullable = false)
    private String phoneNumber;

    @Column(name = "registration_time", nullable = false)
    private Date registrationTime;

    @Column(name = "status", nullable = false)
    private String status;

    @OneToMany(mappedBy = "assessmentRegistration")
    private List<AssessmentRegistrationCustomFieldResponse> assessmentRegistrationCustomFieldResponseList;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}