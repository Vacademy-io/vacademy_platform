package vacademy.io.admin_core_service.features.engagement.dto;

import lombok.Data;

/** A learner completing an item. */
@Data
public class EngagementSubmitRequest {
    /** QUESTION_OF_DAY: the chosen option id. */
    private String selectedOptionId;
    /** GAME/QUIZ: the self-reported score. Clamped server-side to the item's max_score. */
    private Double score;
    /** Free-form per-type response payload, stored as-is for the teacher's tracking view. */
    private String responseJson;
    private Long timeSpentMs;
    /** READING_HTML: how far the learner scrolled, 0-100. */
    private Integer scrollPercent;
}
