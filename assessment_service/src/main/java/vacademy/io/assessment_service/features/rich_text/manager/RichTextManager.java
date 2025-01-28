package vacademy.io.assessment_service.features.rich_text.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;
import vacademy.io.assessment_service.features.rich_text.repository.AssessmentRichTextRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class RichTextManager {

    @Autowired
    AssessmentRichTextRepository assessmentRichTextRepository;

    public List<AssessmentRichTextDataDTO> getRichTextData(CustomUserDetails user, String richTextIds) {

        List<AssessmentRichTextData> assessmentRichTextData = assessmentRichTextRepository.findByIdIn(Arrays.asList(richTextIds.split(",")));
        return assessmentRichTextData.stream().map(AssessmentRichTextDataDTO::new).collect(Collectors.toList());
    }
}
