package vacademy.io.admin_core_service.features.engagement.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Admin-facing plan with its slots and items. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EngagementPlanDTO {
    private String id;
    private String instituteId;
    private String packageSessionId;
    private String title;
    private String description;
    private String subjectId;
    private String status;
    private String timezone;
    private String defaultMissPolicy;
    private Integer defaultCatchUpDays;
    private Integer defaultCatchUpPercent;
    private String createdByUserId;
    private String createdAt;
    private List<EngagementSlotDTO> slots;
}
