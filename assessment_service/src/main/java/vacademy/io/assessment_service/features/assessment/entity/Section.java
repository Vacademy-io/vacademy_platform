package vacademy.io.assessment_service.features.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "section")
@Data
@EqualsAndHashCode(of = "id")
public class Section {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description_id")
    private String descriptionId;

    @Column(name = "section_type", nullable = false)
    private String sectionType;

    @Column(name = "duration")
    private Integer duration;

    @Column(name = "marks_per_question")
    private Integer marksPerQuestion;

    @Column(name = "total_marks")
    private Integer totalMarks;

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