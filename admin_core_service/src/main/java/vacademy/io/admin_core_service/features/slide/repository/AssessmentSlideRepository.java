package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.slide.entity.AssessmentSlide;

import java.util.List;

@Repository
public interface AssessmentSlideRepository extends JpaRepository<AssessmentSlide, String> {

    /**
     * Every assessment_slide row pointing at this assessment. More than one is
     * normal — copying a chapter/course clones the row, so the same assessment
     * can be surfaced by several slides.
     */
    List<AssessmentSlide> findByAssessmentId(String assessmentId);
}
