package vacademy.io.community_service.feature.dashboardwidget.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One entry in the canonical onboarding milestone checklist a super admin starts from. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OnboardingMilestoneTemplateDto {
    private String key;     // stable key, also used as the seeded milestone id
    private String label;   // human label, e.g. "Android app"
}
