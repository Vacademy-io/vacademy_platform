package vacademy.io.admin_core_service.features.admission.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionRequestDTO;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionResponseDTO;
import vacademy.io.admin_core_service.features.admission.service.AdmissionService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/v1/admission")
public class AdmissionController {

    private static final Logger logger = LoggerFactory.getLogger(AdmissionController.class);

    @Autowired
    private AdmissionService admissionService;

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
}
