package vacademy.io.admin_core_service.features.engagement.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One card in the learner feed.
 *
 * For a LOCKED (upcoming) item the content fields are deliberately left NULL — see
 * {@code EngagementLearnerService.toLearnerDto}. Shipping tomorrow's payload and
 * hiding it in the UI puts tomorrow's answer one devtools panel away.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EngagementItemDTO {
    private String id;
    private String slotId;
    private String planId;
    private String packageSessionId;
    /** Batch name, so a learner in several batches can tell the cards apart. */
    private String packageSessionName;
    private String itemType;
    private String title;
    private Integer version;
    private Integer sortOrder;
    private Boolean isRequired;

    // Content — NULL unless the item is currently openable by this learner.
    private String contentHtml;
    private String slideId;
    private String questionId;
    private String assessmentId;
    private String payloadJson;

    private Integer completionPoints;
    private Integer correctPoints;
    private Integer maxScore;

    /** UPCOMING | OPEN | CATCH_UP | CLOSED */
    private String state;
    /** The local date this occurrence runs on (yyyy-MM-dd). */
    private String runDate;
    /** ISO instants for the learner's countdown. */
    private String opensAt;
    private String closesAt;
    private String revealAt;
    private Boolean isRevealed;
    /** Points kept on a late completion (100 while OPEN). */
    private Integer pointsPercent;

    // This learner's progress.
    private String attemptStatus;
    private Boolean isCorrect;
    private Integer pointsAwarded;

    /** Social proof: how many learners have completed it. */
    private Long completedCount;
}
