package vacademy.io.assessment_service.features.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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
    private String userId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "user_email", nullable = false)
    private String userEmail;

    @Column(name = "username", nullable = false)
    private String username;

    @Column(name = "participant_name", nullable = false)
    private String participantName;

    @Column(name = "face_file_id", nullable = false)
    private String faceFileId;

    @Column(name = "reattempt_count", nullable = false)
    private Integer reattemptCount;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "source_id", nullable = false)
    private String sourceId;

    @Column(name = "phone_number", nullable = false)
    private String phoneNumber;

    @Column(name = "registration_time", nullable = false)
    private Date registrationTime;

    @Column(name = "status", nullable = false)
    private String status;

    @OneToMany(mappedBy = "assessmentUserRegistration")
    private Set<AssessmentRegistrationCustomFieldResponse> assessmentRegistrationCustomFieldResponseList= new HashSet<>();

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}