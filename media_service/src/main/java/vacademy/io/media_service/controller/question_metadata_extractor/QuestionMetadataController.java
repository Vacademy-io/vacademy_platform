package vacademy.io.media_service.controller.question_metadata_extractor;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.media_service.controller.question_metadata_extractor.dto.QuestionMetadataExtractorRequest;
import vacademy.io.media_service.controller.question_metadata_extractor.dto.QuestionMetadataExtractorResponse;
import vacademy.io.media_service.controller.question_metadata_extractor.manager.QuestionMetadataManager;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/media-service/ai/question-metadata")
public class QuestionMetadataController {

    @Autowired
    QuestionMetadataManager questionMetadataManager;

    @RequestMapping("/extract")
    public ResponseEntity<QuestionMetadataExtractorResponse> extractQuestionMetadata(@RequestBody QuestionMetadataExtractorRequest request) {
        return ResponseEntity.ok(questionMetadataManager.extractQuestionMetadata(request));
    }
}
