package vacademy.io.admin_core_service.features.applicant.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.applicant.dto.ApplicantDTO;
import vacademy.io.admin_core_service.features.applicant.dto.ApplicantFilterDTO;
import vacademy.io.admin_core_service.features.applicant.dto.ApplyRequestDTO;
import vacademy.io.admin_core_service.features.applicant.dto.ApplyResponseDTO;
import vacademy.io.admin_core_service.features.applicant.service.ApplicantService;
import vacademy.io.admin_core_service.features.applicant.service.ApplicantService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

@RestController
@RequestMapping("/admin-core-service/v1/applicant")
public class ApplicantController {

    private static final Logger logger = LoggerFactory.getLogger(ApplicantController.class);

    private final ApplicantService applicantService;

    @Autowired
    public ApplicantController(ApplicantService applicantService) {
        this.applicantService = applicantService;
    }

    @PostMapping("/onboard")
    public ResponseEntity<String> onboardApplicant(@RequestBody ApplicantDTO applicantDTO) {
        logger.info("Request to onboard Applicant for stage: {}", applicantDTO.getApplicationStageId());
        String applicantId = applicantService.onboardApplicant(applicantDTO);
        return ResponseEntity.ok(applicantId);
    }

    /**
     * Submit application form - handles both pre-filled (from enquiry) and manual
     * (direct) submissions
     */
    @PostMapping("/apply")
    public ResponseEntity<ApplyResponseDTO> submitApplication(@RequestBody ApplyRequestDTO request) {
        logger.info("Request to submit application. InstituteId: {}, Source: {}, SourceId: {}, EnquiryId: {}",
                request.getInstituteId(), request.getSource(), request.getSourceId(), request.getEnquiryId());
        ApplyResponseDTO response = applicantService.submitApplication(request);
        return ResponseEntity.ok(response);
    }

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
     * Initiate Payment for Applicant
     * Wrapper that calls Payment Service and updates Applicant JSON
     */
    @PostMapping("/{applicantId}/payment/initiate")
    public ResponseEntity<PaymentResponseDTO> initiatePayment(
            @PathVariable String applicantId,
            @RequestParam String paymentOptionId,
            @RequestBody PaymentInitiationRequestDTO requestDTO,
            @RequestAttribute(name = "user", required = false) CustomUserDetails userDetails) {

        logger.info("Request to initiate payment. Applicant: {}, Option: {}", applicantId, paymentOptionId);
        PaymentResponseDTO response = applicantService.preparePayment(applicantId, paymentOptionId,
                requestDTO, userDetails);
        return ResponseEntity.ok(response);
    }
}
