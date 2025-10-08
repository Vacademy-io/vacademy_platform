package vacademy.io.media_service.controller.question_metadata_extractor.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.media_service.ai.ExternalAIApiService;
import vacademy.io.media_service.controller.question_metadata_extractor.dto.QuestionMetadataExtractorRequest;
import vacademy.io.media_service.controller.question_metadata_extractor.dto.QuestionMetadataExtractorResponse;

import java.util.List;
import java.util.Map;

@Component
public class QuestionMetadataManager {

    @Autowired
    ExternalAIApiService deepSeekService;

    public QuestionMetadataExtractorResponse extractQuestionMetadata(QuestionMetadataExtractorRequest request) {

        return deepSeekService.getQuestionsMetadata(request);
    }
}
