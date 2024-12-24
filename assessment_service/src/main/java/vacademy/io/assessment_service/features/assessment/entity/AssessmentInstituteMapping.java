package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.entity.Institute;

import java.util.Date;

@Entity
@Table(name = "assessment_institute_mapping")
@Data
@EqualsAndHashCode(of = "id")
public class AssessmentInstituteMapping {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "assessment_id", nullable = false)
    private String assessmentId;

    @ManyToOne
    @JoinColumn(name = "assessment_id", insertable = false, updatable = false)
    private Assessment assessment;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @ManyToOne
    @JoinColumn(name = "institute_id", insertable = false, updatable = false)
    private Institute institute;

    @Column(name = "comma_separated_creation_roles", nullable = true)
    private String commaSeparatedCreationRoles;

    @Column(name = "comma_separated_view_roles", nullable = true)
    private String commaSeparatedViewRoles;

    @Column(name = "comma_separated_evaluation_roles", nullable = true)
    private String commaSeparatedEvaluationRoles;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}