package vacademy.io.assessment_service.features.assessment_free_tool.cotroller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment_free_tool.dto.FullAssessmentDTO;
import vacademy.io.assessment_service.features.assessment_free_tool.service.AssessmentFreeToolGetService;

@RestController
@RequestMapping("/assessment-service/evaluation-tool/assessment")
public class AssessmentFreeToolController {

    @Autowired
    private AssessmentFreeToolGetService getService;

    @GetMapping("/{assessmentId}")
    public FullAssessmentDTO getFullAssessment(@PathVariable String assessmentId) {
        return getService.getFullAssessmentDetails(assessmentId);
    }
}
