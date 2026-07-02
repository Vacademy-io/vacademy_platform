package vacademy.io.community_service.feature.onboarding.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.onboarding.entity.OnboardingLink;

import java.util.List;
import java.util.Optional;

public interface OnboardingLinkRepository extends JpaRepository<OnboardingLink, String> {
    Optional<OnboardingLink> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<OnboardingLink> findAllByOrderByCreatedAtDesc();
}
