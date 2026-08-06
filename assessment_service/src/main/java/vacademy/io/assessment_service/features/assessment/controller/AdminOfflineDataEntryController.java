package vacademy.io.assessment_service.features.assessment.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.offline_entry.OfflineAttachmentsRequest;
import vacademy.io.assessment_service.features.assessment.dto.offline_entry.OfflineAttemptCreateRequest;
import vacademy.io.assessment_service.features.assessment.dto.offline_entry.OfflineBulkImportRequest;
import vacademy.io.assessment_service.features.assessment.dto.offline_entry.OfflineBulkImportResponse;
import vacademy.io.assessment_service.features.assessment.dto.offline_entry.OfflineAttemptCreateResponse;
import vacademy.io.assessment_service.features.assessment.dto.offline_entry.OfflineResponseSubmitRequest;
import vacademy.io.assessment_service.features.assessment.manager.AdminOfflineDataEntryManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/assessment-service/assessment/offline-entry")
public class AdminOfflineDataEntryController {

    @Autowired
    private AdminOfflineDataEntryManager adminOfflineDataEntryManager;

    @PostMapping("/create-attempt")
    public ResponseEntity<OfflineAttemptCreateResponse> createOfflineAttempt(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("assessmentId") String assessmentId,
            @RequestParam(value = "registrationId", required = false) String registrationId,
            @RequestParam("instituteId") String instituteId,
            @RequestBody(required = false) OfflineAttemptCreateRequest request) {
        return adminOfflineDataEntryManager.createOfflineAttempt(userDetails, assessmentId, registrationId, instituteId, request);
    }

    @PostMapping("/submit-responses")
    public ResponseEntity<String> submitOfflineResponses(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("assessmentId") String assessmentId,
            @RequestParam("attemptId") String attemptId,
            @RequestParam("instituteId") String instituteId,
            @RequestBody OfflineResponseSubmitRequest request) {
        return adminOfflineDataEntryManager.submitOfflineResponses(userDetails, assessmentId, attemptId, instituteId, request);
    }

    @PostMapping("/create-and-submit")
    public ResponseEntity<OfflineAttemptCreateResponse> createAndSubmit(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("assessmentId") String assessmentId,
            @RequestParam(value = "registrationId", required = false) String registrationId,
            @RequestParam("instituteId") String instituteId,
            @RequestBody OfflineResponseSubmitRequest request) {
        return adminOfflineDataEntryManager.createAttemptAndSubmitResponses(userDetails, assessmentId, registrationId, instituteId, request);
    }

    @PostMapping("/attach-files")
    public ResponseEntity<String> attachOfflineFiles(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("assessmentId") String assessmentId,
            @RequestParam("attemptId") String attemptId,
            @RequestParam("instituteId") String instituteId,
            @RequestBody OfflineAttachmentsRequest request) {
        return adminOfflineDataEntryManager.attachOfflineFiles(userDetails, assessmentId, attemptId, instituteId, request);
    }

    @PostMapping("/bulk-import")
    public ResponseEntity<OfflineBulkImportResponse> bulkImportOfflineEntries(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("assessmentId") String assessmentId,
            @RequestParam("instituteId") String instituteId,
            @RequestBody OfflineBulkImportRequest request) {
        return adminOfflineDataEntryManager.bulkImportOfflineEntries(userDetails, assessmentId, instituteId, request);
    }
}
