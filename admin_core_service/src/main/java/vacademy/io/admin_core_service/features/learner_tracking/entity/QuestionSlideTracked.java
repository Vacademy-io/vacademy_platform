package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.learner_tracking.dto.QuestionSlideActivityLogDTO;

import java.sql.Timestamp;

@Entity
@Table(name = "question_slide_tracked")
@Getter
@Setter
@NoArgsConstructor
public class QuestionSlideTracked {

    @Id
    private String id;

    private Integer attemptNumber;

    private String responseJson;

    private String responseStatus;

    private Double marks;

    @ManyToOne
    @JoinColumn(name = "activity_id", nullable = false)
    private ActivityLog activityLog;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public QuestionSlideTracked(QuestionSlideActivityLogDTO questionSlideTrackedDTO, ActivityLog activityLog) {
        this.id = questionSlideTrackedDTO.getId();
        this.attemptNumber = questionSlideTrackedDTO.getAttemptNumber();
        this.responseJson = questionSlideTrackedDTO.getResponseJson();
        this.responseStatus = questionSlideTrackedDTO.getResponseStatus();
        this.marks = questionSlideTrackedDTO.getMarks();
        this.activityLog = activityLog;
    }

    public QuestionSlideActivityLogDTO toQuestionSlideActivityLogDTO() {
        QuestionSlideActivityLogDTO questionSlideActivityLogDTO = new QuestionSlideActivityLogDTO();
        questionSlideActivityLogDTO.setId(id);
        questionSlideActivityLogDTO.setAttemptNumber(attemptNumber);
        questionSlideActivityLogDTO.setResponseJson(responseJson);
        questionSlideActivityLogDTO.setResponseStatus(responseStatus);
        questionSlideActivityLogDTO.setMarks(marks);
        return questionSlideActivityLogDTO;
    }

}
