package vacademy.io.admin_core_service.features.learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner.dto.SubOrgEnrollRequestDTO;
import vacademy.io.admin_core_service.features.learner.dto.SubOrgEnrollResponseDTO;
import vacademy.io.admin_core_service.features.learner.dto.SubOrgResponseDTO;
import vacademy.io.admin_core_service.features.learner.dto.SubOrgTerminateRequestDTO;
import vacademy.io.admin_core_service.features.learner.dto.SubOrgTerminateResponseDTO;
import vacademy.io.admin_core_service.features.learner.service.SubOrgLearnerService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/sub-org/v1")
public class SubOrgLearnerController {

    @Autowired
    private SubOrgLearnerService subOrgLearnerService;


    @GetMapping("/members")
    public ResponseEntity<SubOrgResponseDTO> getUsersByPackageAndSubOrg(
            @RequestParam("package_session_id") String packageSessionId,
            @RequestParam("sub_org_id") String subOrgId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        
        SubOrgResponseDTO response = subOrgLearnerService
                .getUsersByPackageSessionAndSubOrg(packageSessionId, subOrgId);
        
        return ResponseEntity.ok(response);
    }
    @PostMapping("/add-member")
    public ResponseEntity<SubOrgEnrollResponseDTO> enrollLearner(
            @RequestBody SubOrgEnrollRequestDTO request,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {

        SubOrgEnrollResponseDTO response = subOrgLearnerService.enrollLearnerToSubOrg(request);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/terminate-member")
    public ResponseEntity<SubOrgTerminateResponseDTO> terminateLearners(
            @RequestBody SubOrgTerminateRequestDTO request,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {

        SubOrgTerminateResponseDTO response = subOrgLearnerService.terminateLearners(request);

        return ResponseEntity.ok(response);
    }
    
}
