package vacademy.io.admin_core_service.features.onboarding.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingInstance;

import java.util.List;

public interface OnboardingInstanceRepository extends JpaRepository<OnboardingInstance, String> {
    List<OnboardingInstance> findBySubjectUserIdAndInstituteId(String subjectUserId, String instituteId);

    List<OnboardingInstance> findByFlowIdAndStatus(String flowId, String status);

    List<OnboardingInstance> findByInstituteIdAndStatus(String instituteId, String status);

    /** Powers the onboarding management dashboard -- every instance for the institute, optionally narrowed to one flow/status. */
    @Query("SELECT o FROM OnboardingInstance o WHERE o.instituteId = :instituteId " +
            "AND (:flowId IS NULL OR o.flowId = :flowId) " +
            "AND (:status IS NULL OR o.status = :status) " +
            "ORDER BY o.startedAt DESC")
    Page<OnboardingInstance> searchInstances(@Param("instituteId") String instituteId,
                                              @Param("flowId") String flowId,
                                              @Param("status") String status,
                                              Pageable pageable);
}
