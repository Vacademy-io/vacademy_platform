package vacademy.io.community_service.feature.onboarding.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.community_service.feature.onboarding.entity.OnboardingSubmission;

public interface OnboardingSubmissionRepository extends JpaRepository<OnboardingSubmission, String> {

    @Query("SELECT s FROM OnboardingSubmission s WHERE "
            + "(:status IS NULL OR s.status = :status) AND "
            + "(:instituteType IS NULL OR s.instituteType = :instituteType) "
            + "ORDER BY s.createdAt DESC")
    Page<OnboardingSubmission> search(@Param("status") String status,
                                      @Param("instituteType") String instituteType,
                                      Pageable pageable);

    long countByStatus(String status);
}
