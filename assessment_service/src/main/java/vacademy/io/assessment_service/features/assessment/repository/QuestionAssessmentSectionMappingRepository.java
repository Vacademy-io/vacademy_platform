package vacademy.io.assessment_service.features.assessment.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;

import java.util.List;
import java.util.Optional;

public interface QuestionAssessmentSectionMappingRepository extends CrudRepository<QuestionAssessmentSectionMapping, String> {


    @Modifying
    @Transactional
    @Query(value = "UPDATE question_assessment_section_mapping SET status = 'DELETED' WHERE question_id IN ?1 AND section_id = ?2", nativeQuery = true)
    void softDeleteByQuestionIdsAndSectionId(List<String> questionIds, String sectionId);


    @Query(value = "SELECT * FROM question_assessment_section_mapping WHERE section_id IN ?1", nativeQuery = true)
    List<QuestionAssessmentSectionMapping> getQuestionAssessmentSectionMappingBySectionIds(List<String> sectionIds);

    @Query(value = "SELECT qasm.* FROM question_assessment_section_mapping qasm " +
            "LEFT JOIN section s ON qasm.section_id = s.id " +
            "WHERE s.assessment_id = ?1 and s.status != 'DELETED' ", nativeQuery = true)
    List<QuestionAssessmentSectionMapping> getQuestionAssessmentSectionMappingByAssessmentId(String assessmentId);

    @Query(value = """
            SELECT qasm.* FROM question_assessment_section_mapping qasm
            WHERE qasm.question_id = :questionId
            AND qasm.section_id = :sectionId LIMIT 1
            """, nativeQuery = true)
    Optional<QuestionAssessmentSectionMapping> findByQuestionIdAndSectionId(@Param("questionId") String questionId,
                                                                            @Param("sectionId") String sectionId);
}