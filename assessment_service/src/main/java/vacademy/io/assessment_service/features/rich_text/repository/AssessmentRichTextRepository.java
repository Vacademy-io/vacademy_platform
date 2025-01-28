package vacademy.io.assessment_service.features.rich_text.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;

import java.util.List;

public interface AssessmentRichTextRepository extends JpaRepository<AssessmentRichTextData, String> {

    List<AssessmentRichTextData> findByIdIn(List<String> ids);

}
