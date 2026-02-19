package vacademy.io.admin_core_service.features.applicant.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.applicant.dto.ApplicationStageDTO;
import vacademy.io.admin_core_service.features.applicant.service.ApplicantService;

@RestController
@RequestMapping("/admin-core-service/v1/application")
public class ApplicationController {

    private static final Logger logger = LoggerFactory.getLogger(ApplicationController.class);

    private final ApplicantService applicantService;

    public ApplicationController(ApplicantService applicantService) {
        this.applicantService = applicantService;
    }

    @PostMapping("/stage")
    public ResponseEntity<String> createApplicationStage(@RequestBody ApplicationStageDTO stageDTO) {
        logger.info("Request to create Application Stage: {}", stageDTO.getStageName());
        String stageId = applicantService.createApplicationStage(stageDTO);
        return ResponseEntity.ok(stageId);
    }

    @org.springframework.web.bind.annotation.GetMapping("/stages")
    public ResponseEntity<java.util.List<ApplicationStageDTO>> listApplicationStages(
            @org.springframework.web.bind.annotation.RequestParam(required = false) String instituteId,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String source,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String sourceId,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String workflowType) {

        logger.info("Request to list Application Stages. Institute: {}, Source: {}, SourceId: {}, WorkflowType: {}",
                instituteId, source,
                sourceId, workflowType);
        java.util.List<ApplicationStageDTO> stages = applicantService.getApplicationStages(instituteId, source,
                sourceId, workflowType);
        return ResponseEntity.ok(stages);
    }
}
