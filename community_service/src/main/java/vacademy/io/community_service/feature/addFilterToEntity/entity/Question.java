package vacademy.io.community_service.feature.addFilterToEntity.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "question")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Question {

    @Id
    @Column(name = "id")
    private String id;

    @Column(name = "text_id")
    private String textId;

    @Column(name = "media_id")
    private String mediaId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "question_response_type")
    private String questionResponseType;

    @Column(name = "question_type")
    private String questionType;

    @Column(name = "access_level")
    private String accessLevel;

    @Column(name = "auto_evaluation_json", columnDefinition = "TEXT")
    private String autoEvaluationJson;

    @Column(name = "evaluation_type")
    private String evaluationType;

    @Column(name = "explanation_text_id")
    private String explanationTextId;

    @Column(name = "default_question_time_mins")
    private Integer defaultQuestionTimeMins;

    @Column(name = "parent_rich_text_id")
    private String parentRichTextId;
}

