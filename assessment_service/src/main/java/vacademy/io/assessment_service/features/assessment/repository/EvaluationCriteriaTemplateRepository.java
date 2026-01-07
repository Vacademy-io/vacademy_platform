package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment.entity.EvaluationCriteriaTemplate;

import java.util.List;

@Repository
public interface EvaluationCriteriaTemplateRepository extends JpaRepository<EvaluationCriteriaTemplate, String> {

        List<EvaluationCriteriaTemplate> findByIsActiveTrue();

        List<EvaluationCriteriaTemplate> findBySubjectAndQuestionTypeAndIsActiveTrue(String subject,
                        String questionType);

        List<EvaluationCriteriaTemplate> findBySubjectAndIsActiveTrue(String subject);

        List<EvaluationCriteriaTemplate> findByQuestionTypeAndIsActiveTrue(String questionType);
}
