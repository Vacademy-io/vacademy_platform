package vacademy.io.community_service.feature.onboarding.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.onboarding.entity.OnboardingDemoAccount;

import java.util.List;
import java.util.Optional;

public interface OnboardingDemoAccountRepository extends JpaRepository<OnboardingDemoAccount, String> {
    Optional<OnboardingDemoAccount> findByInstituteType(String instituteType);

    List<OnboardingDemoAccount> findByActiveTrueOrderBySortOrderAsc();

    List<OnboardingDemoAccount> findAllByOrderBySortOrderAsc();
}
