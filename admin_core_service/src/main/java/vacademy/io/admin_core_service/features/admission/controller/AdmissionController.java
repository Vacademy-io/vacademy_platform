package vacademy.io.admin_core_service.features.admission.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionRequestDTO;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionResponseDetailDTO;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionResponseDTO;
import vacademy.io.admin_core_service.features.admission.dto.BulkAdmissionRowResultDTO;
import vacademy.io.admin_core_service.features.admission.dto.BulkAdmissionSubmitRequestDTO;
import vacademy.io.admin_core_service.features.admission.dto.BulkAdmissionSubmitResponseDTO;
import vacademy.io.admin_core_service.features.admission.dto.BulkAdmissionSubmitRowDTO;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionResponsesListItemDTO;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionResponsesListRequestDTO;
import vacademy.io.admin_core_service.features.admission.service.AdmissionService;
import vacademy.io.admin_core_service.features.admission.service.AdmissionResponsesService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.config.PageConstants;

@RestController
@RequestMapping("/admin-core-service/v1/admission")
public class AdmissionController {

    private static final Logger logger = LoggerFactory.getLogger(AdmissionController.class);

    @Autowired
    private AdmissionService admissionService;

    @Autowired
    private AdmissionResponsesService admissionResponsesService;

    /**
     * Submit a Manual Admission form.
     * Handles both new admissions and transitions from existing online
     * applications.
     */
    @PostMapping("/submit")
    public ResponseEntity<AdmissionResponseDTO> submitAdmissionForm(
            @RequestBody AdmissionRequestDTO request,
            @RequestAttribute(name = "user", required = false) CustomUserDetails userDetails) {

        logger.info("Admission form submission received. InstituteId: {}, Source: {}",
                request.getInstituteId(), request.getSource());

        AdmissionResponseDTO response = admissionService.submitAdmissionForm(request, userDetails);
        return ResponseEntity.ok(response);
    }

    /**
     * Bulk submit admissions from CSV-like rows.
     *
     * Request:
     * - institute_id
     * - rows[] with per-student parent/child details + session/destination_package_session_id
     *
     * Response:
     * - summary.successful / summary.failed
     * - results[] with per-row SUCCESS/FAILED
     */
    @PostMapping("/bulk-submit-with-admission")
    public ResponseEntity<BulkAdmissionSubmitResponseDTO> bulkSubmitAdmissions(
            @RequestBody BulkAdmissionSubmitRequestDTO request,
            @RequestAttribute(name = "user", required = false) CustomUserDetails userDetails) {

        int successful = 0;
        int failed = 0;
        java.util.List<BulkAdmissionRowResultDTO> results = new java.util.ArrayList<>();

        if (request == null || request.getRows() == null) {
            return ResponseEntity.ok(
                    BulkAdmissionSubmitResponseDTO.builder()
                            .summary(BulkAdmissionSubmitResponseDTO.BulkSummaryDTO.builder().successful(0).failed(0).build())
                            .results(new java.util.ArrayList<>())
                            .build());
        }

        java.time.LocalDate today = java.time.LocalDate.now();
        String todayIso = today.toString(); // yyyy-MM-dd

        for (int i = 0; i < request.getRows().size(); i++) {
            BulkAdmissionSubmitRowDTO row = request.getRows().get(i);
            try {
                if (row == null) throw new IllegalArgumentException("Row is null");

                // Split child name => first/last
                java.util.List<String> parts = java.util.Arrays.stream(row.getChildName().split(" "))
                        .filter(p -> p != null && !p.isBlank())
                        .toList();
                String firstName = parts.isEmpty() ? "" : parts.get(0);
                String lastName = parts.size() > 1 ? String.join(" ", parts.subList(1, parts.size())) : "";

                // Generate a deterministic-ish admission number for idempotency within the batch
                String admissionNo = "BULK-ADM-" + System.currentTimeMillis() + "-" + (i + 1);

                AdmissionRequestDTO admissionRequest = AdmissionRequestDTO.builder()
                        .instituteId(request.getInstituteId())
                        .source("INSTITUTE")
                        .sourceId(request.getInstituteId())
                        .sessionId(row.getSessionId())
                        .destinationPackageSessionId(row.getDestinationPackageSessionId())
                        .enquiryId(null)
                        .applicationId(null)

                        .firstName(firstName)
                        .lastName(lastName)
                        .gender(row.getChildGender())
                        .classApplyingFor(row.getDestinationPackageSessionId())
                        .section("") // not used by backend yet, keep safe
                        .admissionNo(admissionNo)
                        .dateOfAdmission(todayIso)
                        .hasTransport(false)
                        .studentType("")
                        .classGroup("")

                        .dateOfBirth(row.getChildDob())
                        .mobileNumber(row.getParentMobile())
                        .admissionType("")
                        .studentAadhaar(null)

                        .previousSchoolName("")
                        .previousClass("")
                        .previousBoard("")
                        .yearOfPassing("")
                        .previousPercentage("")
                        .previousAdmissionNo("")
                        .religion("")
                        .caste("")
                        .motherTongue("")
                        .bloodGroup("")
                        .nationality("")
                        .howDidYouKnow("")

                        // Parent Details (Backend expects father_* for user creation)
                        .fatherName(row.getParentName())
                        .fatherMobile(row.getParentMobile())
                        .fatherEmail(row.getParentEmail())

                        .motherName(null)
                        .motherMobile(null)
                        .motherEmail(null)

                        .guardianName(row.getParentName())
                        .guardianMobile(row.getParentMobile())

                        // Address (bulk CSV contract doesn't include these; keep empty strings)
                        .currentAddress("")
                        .currentLocality("")
                        .currentPinCode("")
                        .permanentAddress("")
                        .permanentLocality("")

                        .customFieldValues(new java.util.HashMap<>())
                        .build();

                admissionService.submitAdmissionForm(admissionRequest, userDetails);

                successful++;
                results.add(BulkAdmissionRowResultDTO.builder()
                        .rowIndex(i)
                        .status("SUCCESS")
                        .success(true)
                        .message(null)
                        .build());
            } catch (Exception e) {
                failed++;
                results.add(BulkAdmissionRowResultDTO.builder()
                        .rowIndex(i)
                        .status("FAILED")
                        .success(false)
                        .message(e.getMessage())
                        .build());
            }
        }

        BulkAdmissionSubmitResponseDTO response = BulkAdmissionSubmitResponseDTO.builder()
                .summary(BulkAdmissionSubmitResponseDTO.BulkSummaryDTO.builder()
                        .successful(successful)
                        .failed(failed)
                        .build())
                .results(results)
                .build();

        return ResponseEntity.ok(response);
    }

    /**
     * Paginated admission responses list for table view.
     * Mandatory: session_id (academic session.id).
     * Optional: destination_package_session_id, created_from/to, from, search_by/search_text.
     */
    @PostMapping("/responses/list")
    public ResponseEntity<Page<AdmissionResponsesListItemDTO>> listAdmissionResponses(
            @RequestBody AdmissionResponsesListRequestDTO request,
            @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(name = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {

        Page<AdmissionResponsesListItemDTO> page = admissionResponsesService.list(request, pageNo, pageSize);
        return ResponseEntity.ok(page);
    }

    /**
     * Detail API for a single admission response row.
     */
    @GetMapping("/responses/{admissionId}")
    public ResponseEntity<AdmissionResponseDetailDTO> getAdmissionResponseDetail(@PathVariable String admissionId) {
        return ResponseEntity.ok(admissionResponsesService.detail(admissionId));
    }
}
