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
