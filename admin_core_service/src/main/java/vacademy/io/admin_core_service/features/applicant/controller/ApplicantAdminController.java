package vacademy.io.admin_core_service.features.applicant.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.applicant.dto.ApplicantDTO;
import vacademy.io.admin_core_service.features.applicant.dto.ApplicantFilterDTO;
import vacademy.io.admin_core_service.features.applicant.dto.ApplicantListRequestDTO;
import vacademy.io.admin_core_service.features.applicant.dto.ApplicantListResponseDTO;
import vacademy.io.admin_core_service.features.applicant.service.ApplicantService;
import vacademy.io.common.auth.config.PageConstants;

/**
 * Admin-facing endpoints for applicant management
 * Handles listing, viewing, and managing applicants
 */
@RestController
@RequestMapping("/admin-core-service/v1/applicant")
public class ApplicantAdminController {

    private static final Logger logger = LoggerFactory.getLogger(ApplicantAdminController.class);

    private final ApplicantService applicantService;

    @Autowired
    public ApplicantAdminController(ApplicantService applicantService) {
        this.applicantService = applicantService;
    }

    @PostMapping("/onboard")
    public ResponseEntity<String> onboardApplicant(@RequestBody ApplicantDTO applicantDTO) {
        logger.info("Request to onboard Applicant for stage: {}", applicantDTO.getApplicationStageId());
        String applicantId = applicantService.onboardApplicant(applicantDTO);
        return ResponseEntity.ok(applicantId);
    }

    /**
     * Enhanced list API with collective filters
     * Supports multiple packageSessionIds, overallStatuses, and search
     */
    @PostMapping("/list")
    public ResponseEntity<Page<ApplicantListResponseDTO>> getApplicantsEnhanced(
            @RequestBody ApplicantListRequestDTO request,
            @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(name = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {

        logger.info("Request to list Applicants. Institute: {}, Source: {}, SourceId: {}, Search: {}",
                request.getInstituteId(), request.getSource(), request.getSourceId(), request.getSearch());

        Page<ApplicantListResponseDTO> applicants = applicantService.getApplicantsEnhanced(request, pageNo, pageSize);
        return ResponseEntity.ok(applicants);
    }

    /**
     * Legacy list API - kept for backward compatibility
     * 
     * @deprecated Use POST /list instead
     */
    @Deprecated
    @GetMapping("/list")
    public ResponseEntity<Page<ApplicantDTO>> getApplicants(
            @RequestParam(required = false) String instituteId,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String sourceId,
            @RequestParam(required = false) String overallStatus,
            @RequestParam(name = "applicationStageId", required = false) String applicationStageId,
            @RequestParam(name = "packageSessionId", required = false) String packageSessionId,
            @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(name = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {

        logger.info("Request to list Applicants. Institute: {}, Source: {}, SourceId: {}", instituteId, source,
                sourceId);
        ApplicantFilterDTO filterDTO = ApplicantFilterDTO.builder()
                .instituteId(instituteId)
                .source(source)
                .sourceId(sourceId)
                .overallStatus(overallStatus)
                .applicationStageId(applicationStageId)
                .packageSessionId(packageSessionId)
                .page(pageNo)
                .size(pageSize)
                .build();

        Page<ApplicantDTO> applicants = applicantService.getApplicants(filterDTO);
        return ResponseEntity.ok(applicants);
    }

    /**
     * Admin endpoint to manually move applicant to next stage
     * Updates applicant, creates new applicant_stage entry, and updates audience_response if workflow type completed
     */
    @PostMapping("/{applicantId}/move-stage")
    public ResponseEntity<String> moveApplicantToNextStage(@PathVariable String applicantId) {
        logger.info("Request to move applicant {} to next stage", applicantId);
        try {
            applicantService.moveApplicantToNextStage(applicantId);
            return ResponseEntity.ok("Applicant moved to next stage successfully");
        } catch (Exception e) {
            logger.error("Error moving applicant to next stage: {}", applicantId, e);
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }
}
