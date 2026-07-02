package vacademy.io.community_service.feature.dashboardwidget.service;

import org.springframework.stereotype.Component;
import vacademy.io.community_service.feature.dashboardwidget.dto.OnboardingMilestoneTemplateDto;

import java.util.List;

/**
 * The canonical onboarding/implementation milestone checklist a super admin starts from when
 * creating a tracker. They can edit/remove these and add freeform rows in the authoring UI, so this
 * is a convenience default, not an enforced schema.
 */
@Component
public class OnboardingTemplateProvider {

    private static final List<OnboardingMilestoneTemplateDto> TEMPLATE = List.of(
            milestone("account-setup", "Account & admin setup"),
            milestone("branding", "Branding & theme"),
            milestone("data-import", "Learner & course data import"),
            milestone("course-config", "Course / batch configuration"),
            milestone("payment-gateway", "Payment gateway setup"),
            milestone("live-classes", "Live classes configuration"),
            milestone("android-app", "Android app"),
            milestone("ios-app", "iOS app"),
            milestone("custom-domain", "Custom domain & emails"),
            milestone("go-live", "Go-live")
    );

    public List<OnboardingMilestoneTemplateDto> getTemplate() {
        return TEMPLATE;
    }

    private static OnboardingMilestoneTemplateDto milestone(String key, String label) {
        return OnboardingMilestoneTemplateDto.builder().key(key).label(label).build();
    }
}
