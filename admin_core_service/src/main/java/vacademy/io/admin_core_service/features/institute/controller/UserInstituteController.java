package vacademy.io.admin_core_service.features.institute.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.dto.InstituteDashboardResponse;
import vacademy.io.admin_core_service.features.institute.manager.InstituteInitManager;
import vacademy.io.admin_core_service.features.institute.service.UserInstituteService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

@RestController
@RequestMapping("/admin-core-service/institute/v1")
public class UserInstituteController {

    @Autowired
    private UserInstituteService instituteService;

    @Autowired
    private InstituteInitManager instituteInitManager;

    @PostMapping("/internal/create")
    public ResponseEntity<InstituteIdAndNameDTO> registerUserInstitutes(@RequestBody InstituteInfoDTO request) {

        InstituteIdAndNameDTO institutes = instituteService.saveInstitute(request);
        return ResponseEntity.ok(institutes);
    }

    @GetMapping("/details/{instituteId}")
    public ResponseEntity<InstituteInfoDTO> getInstituteDetails(@PathVariable String instituteId) {

        InstituteInfoDTO instituteInfoDTO = instituteInitManager.getInstituteDetails(instituteId);
        return ResponseEntity.ok(instituteInfoDTO);
    }

    @GetMapping("/get-dashboard")
    public ResponseEntity<InstituteDashboardResponse> getInstituteDashboard(@RequestAttribute(name = "user") CustomUserDetails user,
                                                                            @RequestParam("instituteId") String instituteId){
        return instituteService.getInstituteDashboardDetail(user,instituteId);
    }


}
