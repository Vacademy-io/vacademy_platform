package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;

import java.util.List;
import java.util.Optional;

public interface AssessmentUserRegistrationRepository extends JpaRepository<AssessmentUserRegistration, String> {
    @Modifying
    @Transactional
    @Query(value = "UPDATE assessment_user_registration SET status = 'DELETED' WHERE assessment_id = ?1 AND user_id IN ?2 AND (institute_id = ?3 OR ?3 IS NULL AND institute_id IS NULL)", nativeQuery = true)
    void softDeleteByAssessmentIdAndUserIdsAndInstituteId(String assessmentId, List<String> userIds, String instituteId);

    @Query("SELECT a FROM AssessmentUserRegistration a WHERE a.userId = :userId AND a.instituteId = :instituteId ORDER BY a.createdAt DESC")
    Optional<AssessmentUserRegistration> findTopByUserIdAndInstituteId(@Param("userId") String userId, @Param("instituteId") String instituteId);

    @Query(value = "SELECT * FROM assessment_user_registration a WHERE a.user_id = :userId AND a.assessment_id = :assessmentId ORDER BY a.created_at DESC", nativeQuery = true)
    Optional<AssessmentUserRegistration> findTopByUserIdAndAssessmentId(@Param("userId") String userId, @Param("assessmentId") String assessmentId);
}
