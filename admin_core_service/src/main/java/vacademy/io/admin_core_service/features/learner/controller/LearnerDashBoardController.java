package vacademy.io.admin_core_service.features.learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner.dto.LeanerDashBoardDetailDTO;
import vacademy.io.admin_core_service.features.learner.service.LearnerDashBoardService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;


@RestController
@RequestMapping("/admin-core-service/learner/v1")
public class LearnerDashBoardController {
    @Autowired
    private LearnerDashBoardService learnerDashBoardService;

    @PostMapping("/get-dashboard-details")
    public ResponseEntity<LeanerDashBoardDetailDTO> getLeanerDashBoardDetail(@RequestAttribute("user") CustomUserDetails user, @RequestBody List<String> packageSessionIds, @RequestParam String instituteId) {
        return ResponseEntity.ok(learnerDashBoardService.getLearnerDashBoardDetail(instituteId, packageSessionIds, user));
    }
}
