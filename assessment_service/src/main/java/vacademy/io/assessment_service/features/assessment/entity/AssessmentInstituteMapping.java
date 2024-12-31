package vacademy.io.assessment_service.features.assessment.entity;


import jakarta.persistence.*;
import lombok.Data;

import java.sql.Timestamp;

@Entity
@Data
@Table(name = "assessment_institute_mapping")
public class AssessmentInstituteMapping {

    @Id
    @Column(name = "id", nullable = false, length = 255)
    private String id;

    @ManyToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "assessment_id")
    private Assessment assessment;

    @Column(name = "institute_id", nullable = false, length = 255)
    private String instituteId;

    @Column(name = "comma_separated_creation_roles", length = 255)
    private String commaSeparatedCreationRoles;

    @Column(name = "comma_separated_view_roles", length = 255)
    private String commaSeparatedViewRoles;

    @Column(name = "comma_separated_evaluation_roles", length = 255)
    private String commaSeparatedEvaluationRoles;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    @Column(name = "subject_id", length = 255)
    private String subjectId;

}
