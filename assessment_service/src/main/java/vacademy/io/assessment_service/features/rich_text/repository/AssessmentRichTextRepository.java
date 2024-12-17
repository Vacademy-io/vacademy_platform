package vacademy.io.assessment_service.features.rich_text.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;

import java.util.List;

public interface AssessmentRichTextRepository extends JpaRepository<AssessmentRichTextData, String> {

}
