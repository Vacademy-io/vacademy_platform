package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReferralOptionRepository extends JpaRepository<ReferralOption, String> {
    List<ReferralOption> findBySourceAndSourceIdAndStatusIn(String source, String sourceId, List<String> status);
    Optional<ReferralOption> findFirstBySourceAndSourceIdAndTagAndStatusInOrderByCreatedAtDesc(
            String source,
            String sourceId,
            String tag,
            List<String> status
    );
}
