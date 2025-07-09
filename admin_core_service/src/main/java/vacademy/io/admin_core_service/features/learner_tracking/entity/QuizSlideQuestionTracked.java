package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.admin_core_service.features.learner_tracking.dto.QuizSideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.VideoSlideQuestionActivityLogDTO;
import java.sql.Timestamp;

@Entity
@Table(name = "quiz_slide_question_tracked")
@NoArgsConstructor
@Getter
@Setter
public class QuizSlideQuestionTracked {
    @Id
    private String id;

    private String responseJson;

    private String responseStatus;

    private String questionId;

    @ManyToOne
    @JoinColumn(name = "activity_id", nullable = false)
    private ActivityLog activityLog;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public QuizSlideQuestionTracked(QuizSideActivityLogDTO quizSideActivityLogDTO, ActivityLog activityLog) {
        this.id = quizSideActivityLogDTO.getId();
        this.responseJson = quizSideActivityLogDTO.getResponseJson();
        this.responseStatus = quizSideActivityLogDTO.getResponseStatus();
        this.activityLog = activityLog;
        this.questionId = quizSideActivityLogDTO.getQuestionId();
    }

    public QuizSideActivityLogDTO toQuizSideActivityLogDTO() {
        QuizSideActivityLogDTO videoSlideQuestionActivityLogDTO = new QuizSideActivityLogDTO();
        videoSlideQuestionActivityLogDTO.setId(id);
        videoSlideQuestionActivityLogDTO.setResponseJson(responseJson);
        videoSlideQuestionActivityLogDTO.setResponseStatus(responseStatus);
        videoSlideQuestionActivityLogDTO.setQuestionId(questionId);
        return videoSlideQuestionActivityLogDTO;
    }
}
