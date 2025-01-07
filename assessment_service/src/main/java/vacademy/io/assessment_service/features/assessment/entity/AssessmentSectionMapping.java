package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.Date;

@Entity
@Table(name = "assessment_section_mapping")
@Data
public class AssessmentSectionMapping {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne
    @JoinColumn(name = "assessment_id")
    private Assessment assessment;

    @Column(name = "marking_json", nullable = false)
    private String markingJson;

    @ManyToOne
    @JoinColumn(name = "section_id")
    private Section section;
    
    @Column(name = "section_order", nullable = false)
    private Integer questionOrder;

    @Column(name = "duration_in_min", nullable = false)
    private Integer durationInMin;
    
    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;
    
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
