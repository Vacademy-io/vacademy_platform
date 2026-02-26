package vacademy.io.admin_core_service.features.admission.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.admission.dto.SchoolEnrollRequestDTO;
import vacademy.io.admin_core_service.features.admission.dto.SchoolEnrollResponseDTO;
import vacademy.io.admin_core_service.features.admission.service.SchoolEnrollService;
import vacademy.io.common.auth.model.CustomUserDetails;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/v1/school")
public class SchoolEnrollController {

    @Autowired
    private SchoolEnrollService schoolEnrollService;

    @PostMapping("/enroll")
    public ResponseEntity<SchoolEnrollResponseDTO> enrollStudent(
            @RequestAttribute("user") CustomUserDetails admin,
            @RequestBody SchoolEnrollRequestDTO request) {
        log.info("School enrollment request received for institute: {}", request.getInstituteId());
        SchoolEnrollResponseDTO response = schoolEnrollService.enrollStudent(request);
        return ResponseEntity.ok(response);
    }
}
