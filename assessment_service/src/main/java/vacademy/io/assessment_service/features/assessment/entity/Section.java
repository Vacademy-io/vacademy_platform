package vacademy.io.assessment_service.features.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;

import java.util.Date;

@Entity
@Table(name = "section")
@Data
@EqualsAndHashCode(of = "id")
@FilterDef(name = "activeSections", parameters = @ParamDef(name = "status", type = String.class))
@Filter(name = "activeSections", condition = "status = :status")
public class Section {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "description_id")
    private AssessmentRichTextData description;

    @Column(name = "section_type")
    private String sectionType;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "cut_off_marks")
    private Double cutOffMarks;

    @Column(name = "problem_random_type")
    private String problemRandomType;

    @Column(name = "duration")
    private Integer duration;

    @Column(name = "marks_per_question")
    private Double marksPerQuestion;

    @Column(name = "total_marks")
    private Double totalMarks;

    @Column(name = "section_order", nullable = false)
    private Integer sectionOrder;

    @ManyToOne
    @JoinColumn(name = "assessment_id")
    @JsonIgnore
    private Assessment assessment;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}