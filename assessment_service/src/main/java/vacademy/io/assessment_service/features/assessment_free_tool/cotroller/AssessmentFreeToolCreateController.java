package vacademy.io.assessment_service.features.assessment_free_tool.cotroller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.BasicAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment_free_tool.dto.AiPublishAssessmentRequest;
import vacademy.io.assessment_service.features.assessment_free_tool.dto.SectionDTO;
import vacademy.io.assessment_service.features.assessment_free_tool.service.AiPublishAssessmentService;
import vacademy.io.assessment_service.features.assessment_free_tool.service.AssessmentFreeToolCreateService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/assessment-service/evaluation-tool/assessment")
public class AssessmentFreeToolCreateController {

    @Autowired
    private AssessmentFreeToolCreateService createService;

    @Autowired
    private AiPublishAssessmentService aiPublishService;

    @PostMapping("/create")
    public ResponseEntity<String> createAssessment(@RequestBody BasicAssessmentDetailsDTO assessmentDetails) {
        String assessmentId = createService.createAssessment(assessmentDetails);
        return ResponseEntity.ok(assessmentId);
    }

    @PostMapping("/sections")
    public ResponseEntity<String> addSectionsWithQuestions(
            @RequestParam String assessmentId,
            @RequestBody List<SectionDTO> sectionDTOS
    ) {
        String result = createService.addSectionsWithQuestions(sectionDTOS, assessmentId);
        return ResponseEntity.ok(result);
    }

    /**
     * Publishes an AI-generated MCQ assessment in one shot:
     * creates Assessment + Section + Questions + Options + correct-answer JSON
     * + section mappings. Used by admin-core when a teacher clicks Publish
     * on the Create-Assessment-from-Recording modal.
     *
     * Returns the new assessment id so admin-core can store it on the
     * ai_generated_artifact row.
     */
    @PostMapping("/ai-publish")
    public ResponseEntity<Map<String, String>> aiPublishAssessment(
            @RequestBody AiPublishAssessmentRequest request) {
        String assessmentId = aiPublishService.publish(request);
        return ResponseEntity.ok(Map.of("assessmentId", assessmentId));
    }

}
