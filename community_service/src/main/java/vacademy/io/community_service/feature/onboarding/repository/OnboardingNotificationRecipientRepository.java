package vacademy.io.community_service.feature.onboarding.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.onboarding.entity.OnboardingNotificationRecipient;

import java.util.List;

public interface OnboardingNotificationRecipientRepository
        extends JpaRepository<OnboardingNotificationRecipient, String> {
    List<OnboardingNotificationRecipient> findByActiveTrue();

    List<OnboardingNotificationRecipient> findAllByOrderByCreatedAtAsc();
}
