package vacademy.io.assessment_service.features.translation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.assessment_service.features.translation.entity.AssessmentTranslationCoverage;

import java.util.Optional;

public interface AssessmentTranslationCoverageRepository extends JpaRepository<AssessmentTranslationCoverage, String> {

    Optional<AssessmentTranslationCoverage> findByAssessmentIdAndLocale(String assessmentId, String locale);
}
