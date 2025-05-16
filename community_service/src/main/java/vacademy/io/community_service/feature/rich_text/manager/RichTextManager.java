package vacademy.io.community_service.feature.rich_text.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.rich_text.dto.AssessmentRichTextDataDTO;
import vacademy.io.community_service.feature.rich_text.entity.AssessmentRichTextData;
import vacademy.io.community_service.feature.rich_text.repository.AssessmentRichTextRepository;

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
