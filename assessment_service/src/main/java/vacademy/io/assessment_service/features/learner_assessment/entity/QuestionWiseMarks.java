package vacademy.io.assessment_service.features.learner_assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.Date;

@Entity
@Table(name = "question_wise_marks")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class QuestionWiseMarks {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne
    @JoinColumn(name = "assessment_id")
    @JsonIgnore
    private Assessment assessment;

    @ManyToOne
    @JoinColumn(name = "attempt_id")
    @JsonIgnore
    private StudentAttempt studentAttempt;

    @ManyToOne
    @JoinColumn(name = "question_id")
    @JsonIgnore
    private Question question;

    @Column(name = "marks")
    private double marks;

    @Column(name = "status")
    private String status;

    @Column(name = "time_taken_in_seconds")
    private Long timeTakenInSeconds;

    @Column(name = "response_json")
    private String responseJson;

    @ManyToOne
    @JoinColumn(name = "section_id")
    @JsonIgnore
    private Section section;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
