package vacademy.io.admin_core_service.features.engagement.dto;

import lombok.Data;

import java.util.List;

/** Create/update payload for a plan. */
@Data
public class EngagementPlanRequest {
    private String title;
    private String description;
    private String packageSessionId;
    private String subjectId;
    /** DRAFT | PUBLISHED | ARCHIVED */
    private String status;
    private String defaultMissPolicy;
    private Integer defaultCatchUpDays;
    private Integer defaultCatchUpPercent;
    private List<EngagementSlotRequest> slots;
}
