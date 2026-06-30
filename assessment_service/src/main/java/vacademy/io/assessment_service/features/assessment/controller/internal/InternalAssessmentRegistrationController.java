package vacademy.io.assessment_service.features.assessment.controller.internal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.assessment_service.features.assessment.dto.internal.RegisterAssessmentBatchesRequest;
import vacademy.io.assessment_service.features.assessment.manager.InternalAssessmentBatchRegistrationManager;

/**
 * Internal (service-to-service) endpoint to add batches to existing assessments.
 *
 * <p><b>Security:</b> mapped under {@code /assessment-service/internal/**}, which is guarded by
 * {@code InternalAuthFilter} (common_service) — requests must carry {@code clientName} and
 * {@code Signature} HMAC headers. No JWT required. Same pattern as
 * {@code StudentAnalysisInternalController}.
 *
 * <p>Called by admin_core_service when a chapter holding an assessment slide is
 * copied / made visible to new batches, to keep the assessment's batch list in
 * sync with the chapter's package_sessions.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/assessment-service/internal/assessment-registration")
public class InternalAssessmentRegistrationController {

    private final InternalAssessmentBatchRegistrationManager manager;

    @PostMapping("/register-batches")
    public ResponseEntity<String> registerBatches(@RequestBody RegisterAssessmentBatchesRequest request) {
        manager.registerBatches(request);
        return ResponseEntity.ok("Done");
    }
}
