package vacademy.io.admin_core_service.features.applicant.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.applicant.dto.ApplicantStageDTO;
import vacademy.io.admin_core_service.features.applicant.dto.ApplyRequestDTO;
import vacademy.io.admin_core_service.features.applicant.dto.ApplyResponseDTO;
import vacademy.io.admin_core_service.features.applicant.service.ApplicantService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.admin_core_service.features.applicant.dto.ParentWithChildrenResponseDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.util.List;

/**
 * Public-facing endpoints for applicant operations
 * Handles application submission and payment initiation
 * No authentication required (or optional authentication)
 */
@RestController
@RequestMapping("/admin-core-service/v1/applicant")
public class ApplicantPublicController {

    private static final Logger logger = LoggerFactory.getLogger(ApplicantPublicController.class);

    private final ApplicantService applicantService;

    @Autowired
    public ApplicantPublicController(ApplicantService applicantService) {
        this.applicantService = applicantService;
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

    @GetMapping("/parent/{parentUserId}")
    public ResponseEntity<ParentWithChildrenResponseDTO> getParentWithChildren(@PathVariable String parentUserId) {
        logger.info("Request to fetch parent details with children for parentUserId: {}", parentUserId);
        ParentWithChildrenResponseDTO response = applicantService.getParentWithChildren(parentUserId);
        return ResponseEntity.ok(response);
    }

    /**
     * Get all stages for an applicant
     */
    @GetMapping("/{applicantId}/stages")
    public ResponseEntity<List<ApplicantStageDTO>> getApplicantStages(@PathVariable String applicantId) {
        logger.info("Request to fetch stages for applicantId: {}", applicantId);
        List<ApplicantStageDTO> stages = applicantService.getApplicantStages(applicantId);
        return ResponseEntity.ok(stages);
    }
}
