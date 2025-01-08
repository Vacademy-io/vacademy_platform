package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentBatchRegistration;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentCustomField;

import java.util.List;

public interface AssessmentCustomFieldRepository extends JpaRepository<AssessmentCustomField, String> {

    @Modifying
    @Transactional
    @Query(value = "UPDATE assessment_custom_fields SET status = 'DELETED' WHERE assessment_id = ?1 AND field_key IN ?2", nativeQuery = true)
    void softDeleteByAssessmentIdAndFieldKeys(String assessmentId, List<String> fieldKeys);

}
