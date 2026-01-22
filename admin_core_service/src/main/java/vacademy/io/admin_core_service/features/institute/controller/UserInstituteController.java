package vacademy.io.admin_core_service.features.institute.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.dto.InstituteDashboardResponse;
import vacademy.io.admin_core_service.features.institute.dto.InstituteSetupDTO;
import vacademy.io.admin_core_service.features.institute.manager.InstituteInitManager;
import vacademy.io.admin_core_service.features.institute.service.UserInstituteService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/institute/v1")
public class UserInstituteController {

    @Autowired
    private UserInstituteService instituteService;

    @Autowired
    private InstituteInitManager instituteInitManager;

    @PostMapping("/internal/create")
    public ResponseEntity<InstituteIdAndNameDTO> registerUserInstitutes(@RequestBody InstituteInfoDTO request) {

        // Log incoming InstituteInfoDTO with all school-specific fields
        log.info("=== ADMIN CORE SERVICE: Incoming InstituteInfoDTO ===");
        log.info("Institute Name: {}", request.getInstituteName());
        log.info("Board: {}", request.getBoard());
        log.info("GST Details: {}", request.getGstDetails());
        log.info("Affiliation Number: {}", request.getAffiliationNumber());
        log.info("Staff Strength: {}", request.getStaffStrength());
        log.info("School Strength: {}", request.getSchoolStrength());
        log.info("Full InstituteInfoDTO: {}", request);

        InstituteIdAndNameDTO institutes = instituteService.saveInstitute(request);

        log.info("=== ADMIN CORE SERVICE: Response ===");
        log.info("Created Institute ID: {}, Name: {}", institutes.getInstituteId(), institutes.getInstituteName());

        return ResponseEntity.ok(institutes);
    }

    @GetMapping("/details/{instituteId}")
    public ResponseEntity<InstituteInfoDTO> getInstituteDetails(@PathVariable String instituteId) {
        InstituteInfoDTO instituteInfoDTO = instituteInitManager.getInstituteDetails(instituteId, true);
        return ResponseEntity.ok(instituteInfoDTO);
    }

    @GetMapping("/details-non-batches/{instituteId}")
    public ResponseEntity<InstituteInfoDTO> getInstituteDetailsNonBatches(@PathVariable String instituteId) {
        InstituteInfoDTO instituteInfoDTO = instituteInitManager.getInstituteDetails(instituteId, false);
        return ResponseEntity.ok(instituteInfoDTO);
    }

    @GetMapping("/setup/{instituteId}")
    public ResponseEntity<InstituteSetupDTO> getInstituteSetupDetails(@PathVariable String instituteId) {
        InstituteSetupDTO instituteSetupDTO = instituteInitManager.getInstituteSetupDetails(instituteId, true);
        return ResponseEntity.ok(instituteSetupDTO);
    }

    @GetMapping("/setup-without-batches/{instituteId}")
    public ResponseEntity<InstituteSetupDTO> getInstituteSetupDetailsWithoutBatches(@PathVariable String instituteId) {
        InstituteSetupDTO instituteSetupDTO = instituteInitManager.getInstituteSetupDetails(instituteId, false);
        return ResponseEntity.ok(instituteSetupDTO);
    }

    @PostMapping("/institute-update")
    public ResponseEntity<String> updateInstitute(@RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestBody InstituteInfoDTO instituteInfoDTO) {
        return instituteService.updateInstituteDetails(user, instituteId, instituteInfoDTO);
    }

    @GetMapping("/get-dashboard")
    @Cacheable(value = "instituteDashboard", key = "#user.id + ':' + #instituteId")
    public ResponseEntity<InstituteDashboardResponse> getInstituteDashboard(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId) {
        return instituteService.getInstituteDashboardDetail(user, instituteId);
    }

    @PutMapping("/add-letterhead-file-id")
    public ResponseEntity<String> addLetterheadFileId(@RequestParam("instituteId") String instituteId,
            @RequestParam("letterheadFileId") String letterheadFileId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(instituteService.addLetterHeadFileId(instituteId, letterheadFileId, user));
    }

    @GetMapping("/get-letterhead-file-id")
    public ResponseEntity<String> getLetterheadFileId(@RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(instituteService.getLetterFileId(instituteId, user));
    }

}
