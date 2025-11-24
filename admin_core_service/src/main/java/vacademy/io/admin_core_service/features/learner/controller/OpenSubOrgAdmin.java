package vacademy.io.admin_core_service.features.learner.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner.dto.UserAdminDetailsResponseDTO;
import vacademy.io.admin_core_service.features.learner.service.SubOrgLearnerService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/open/v1")
public class OpenSubOrgAdmin {
    @Autowired
    private SubOrgLearnerService subOrgLearnerService;

    @GetMapping("/member-admin-details")
    public ResponseEntity<UserAdminDetailsResponseDTO> getAdminDetailsByUserId(
            @RequestParam("userId") String userId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {

        UserAdminDetailsResponseDTO response = subOrgLearnerService.getAdminDetailsByUserId(userId);

        return ResponseEntity.ok(response);
    }
}
