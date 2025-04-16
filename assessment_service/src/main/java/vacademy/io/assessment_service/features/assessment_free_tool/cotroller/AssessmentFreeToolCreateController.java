package vacademy.io.assessment_service.features.assessment_free_tool.cotroller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.BasicAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment_free_tool.dto.SectionDTO;
import vacademy.io.assessment_service.features.assessment_free_tool.service.AssessmentFreeToolCreateService;

import java.util.List;

@RestController
@RequestMapping("/assessment-service/evaluation-tool/assessment")
public class AssessmentFreeToolCreateController {

    @Autowired
    private AssessmentFreeToolCreateService createService;

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

}
