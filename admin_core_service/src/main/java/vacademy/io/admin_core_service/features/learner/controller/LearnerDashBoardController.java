package vacademy.io.admin_core_service.features.learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.learner.dto.LeanerDashBoardDetailDTO;
import vacademy.io.admin_core_service.features.learner.service.LearnerDashBoardService;
import vacademy.io.common.auth.model.CustomUserDetails;


@RestController
@RequestMapping("/admin-core-service/learner/v1")
public class LearnerDashBoardController {
    @Autowired
    private LearnerDashBoardService learnerDashBoardService;

    @GetMapping("/get-dashboard-details")
    public ResponseEntity<LeanerDashBoardDetailDTO> getLeanerDashBoardDetail(@RequestAttribute("user") CustomUserDetails user,String instituteId) {
        return ResponseEntity.ok(learnerDashBoardService.getLearnerDashBoardDetail(instituteId,user));
    }
}
