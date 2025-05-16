package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.Date;

@Entity
@Table(name = "question_assessment_section_mapping")
@Data
public class QuestionAssessmentSectionMapping {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne
    @JoinColumn(name = "question_id")
    private Question question;

    @Column(name = "marking_json", nullable = false)
    private String markingJson;

    @Column(name = "status", nullable = false)
    private String status;

    @ManyToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "section_id")
    private Section section;

    @Column(name = "question_order", nullable = false)
    private Integer questionOrder;

    @Column(name = "question_duration_in_min", nullable = false)
    private Integer questionDurationInMin;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
