package vacademy.io.assessment_service.features.assessment.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;

import java.util.List;

public interface QuestionAssessmentSectionMappingRepository extends CrudRepository<QuestionAssessmentSectionMapping, String> {


    @Modifying
    @Transactional
    @Query(value = "UPDATE question_assessment_section_mapping SET status = 'DELETED' WHERE question_id IN ?1 AND section_id = ?2", nativeQuery = true)
    void softDeleteByQuestionIdsAndSectionId(List<String> questionIds, String sectionId);

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO question_assessment_section_mapping (id, question_id, marking_json, section_id, question_order, question_duration_in_min, status, created_at, updated_at) VALUES ?1", nativeQuery = true)
    void bulkInsert(List<Object[]> batch);

    @Query(value = "SELECT * FROM question_assessment_section_mapping WHERE section_id IN ?1", nativeQuery = true)
    List<QuestionAssessmentSectionMapping> getQuestionAssessmentSectionMappingBySectionIds(List<String> sectionIds);
}