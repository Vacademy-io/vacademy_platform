package vacademy.io.admin_core_service.features.engagement.dto;

import lombok.Data;

/**
 * Authoring payload for one item.
 *
 * For QUESTION_OF_DAY the options and the answer key travel inside {@code payloadJson}:
 * {"options":[{"id":"a","text":"..."}],"correctOptionId":"a","explanation":"..."}
 * The key is stripped before the item ever reaches a learner and grading happens
 * server-side, which is what makes this item type genuinely verifiable.
 */
@Data
public class EngagementItemRequest {
    private String id;
    private String itemType;
    private String title;
    private Integer sortOrder;
    private Boolean isRequired;
    private String contentHtml;
    private String slideId;
    private String questionId;
    private String assessmentId;
    private String payloadJson;
    private Integer completionPoints;
    private Integer correctPoints;
    private Integer maxScore;
    private String missPolicy;
    private Integer catchUpDays;
    private Integer catchUpPercent;
}
