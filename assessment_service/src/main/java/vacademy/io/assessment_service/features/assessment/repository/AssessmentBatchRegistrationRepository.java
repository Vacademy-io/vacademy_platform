package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentBatchRegistration;

import java.util.List;

public interface AssessmentBatchRegistrationRepository extends JpaRepository<AssessmentBatchRegistration, String> {

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO assessment_batch_registration (id, assessment_id, batch_id, institute_id, registration_time, status, created_at, updated_at) VALUES ?1", nativeQuery = true)
    void bulkInsert(List<Object[]> batch);

    @Modifying
    @Transactional
    @Query(value = "UPDATE assessment_batch_registration SET status = 'DELETED' WHERE id IN ?1 AND institute_id = ?2 AND assessment_id = ?3", nativeQuery = true)
    void softDeleteByIds(List<String> ids, String instituteId, String assessmentId);
}
