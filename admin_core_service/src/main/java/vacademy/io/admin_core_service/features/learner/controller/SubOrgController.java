package vacademy.io.admin_core_service.features.learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner.dto.SubOrgResponseDTO;
import vacademy.io.admin_core_service.features.learner.service.SubOrgService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/sub-org/v1")
public class SubOrgController {

    @Autowired
    private SubOrgService subOrgService;

    @GetMapping("/members")
    public ResponseEntity<SubOrgResponseDTO> getUsersByPackageAndSubOrg(
            @RequestParam("package_session_id") String packageSessionId,
            @RequestParam("sub_org_id") String subOrgId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        
        SubOrgResponseDTO response = subOrgService
                .getUsersByPackageSessionAndSubOrg(packageSessionId, subOrgId);
        
        return ResponseEntity.ok(response);
    }
}
