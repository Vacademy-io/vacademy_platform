package vacademy.io.community_service.feature.support.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.community_service.feature.support.enums.SupportPlan;

/** A single support-plan catalogue entry — the SLA source the frontends render from. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportPlanDto {
    private String key;
    private String displayName;
    private String description;
    private String hoursOfOperation;
    private boolean dedicatedEngineer;
    private Integer majorSlaHours;
    private String majorSlaText;
    private Integer minorSlaHours;
    private String minorSlaText;

    public static SupportPlanDto from(SupportPlan plan) {
        return SupportPlanDto.builder()
                .key(plan.name())
                .displayName(plan.getDisplayName())
                .description(plan.getDescription())
                .hoursOfOperation(plan.getHoursOfOperation())
                .dedicatedEngineer(plan.isDedicatedEngineer())
                .majorSlaHours(plan.getMajorSlaHours())
                .majorSlaText(plan.getMajorSlaText())
                .minorSlaHours(plan.getMinorSlaHours())
                .minorSlaText(plan.getMinorSlaText())
                .build();
    }
}
