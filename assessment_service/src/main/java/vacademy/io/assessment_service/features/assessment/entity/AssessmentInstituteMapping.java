package vacademy.io.assessment_service.features.assessment.entity;


import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Data
@Table(name = "assessment_institute_mapping")
public class AssessmentInstituteMapping {

    @Id
    @Column(name = "id", nullable = false, length = 255)
    @UuidGenerator
    private String id;

    @ManyToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "assessment_id")
    private Assessment assessment;

    @Column(name = "institute_id", nullable = false, length = 255)
    private String instituteId;

    @Column(name = "assessment_url", nullable = false, length = 255)
    private String assessmentUrl;

    @Column(name = "comma_separated_creation_roles", length = 255)
    private String commaSeparatedCreationRoles;

    @Column(name = "comma_separated_creation_user_ids", length = 255)
    private String commaSeparatedCreationUserIds;

    @Column(name = "comma_separated_submission_view_roles", length = 255)
    private String commaSeparatedSubmissionViewRoles;

    @Column(name = "comma_separated_submission_view_user_ids", length = 255)
    private String commaSeparatedSubmissionViewUserIds;

    @Column(name = "comma_separated_evaluation_roles", length = 255)
    private String commaSeparatedEvaluationRoles;

    @Column(name = "comma_separated_evaluation_user_ids", length = 255)
    private String commaSeparatedEvaluationUserIds;

    @Column(name = "comma_separated_live_roles", length = 255)
    private String commaSeparatedLiveViewRoles;

    @Column(name = "comma_separated_live_user_ids", length = 255)
    private String commaSeparatedLiveViewUserIds;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    @Column(name = "subject_id", length = 255)
    private String subjectId;

    @Column(name = "evaluation_setting")
    private String evaluationSetting;

}
