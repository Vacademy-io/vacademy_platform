package vacademy.io.admin_core_service.features.learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentDTO;
import vacademy.io.admin_core_service.features.learner.manager.LearnerProfileManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/learner/info/v1")
public class LearnerUserInfoController {

    @Autowired
    LearnerProfileManager learnerProfileManager;

    @GetMapping("/details")
    public ResponseEntity<List<StudentDTO>> getLearnerInfo(@RequestAttribute("user") CustomUserDetails user, @RequestParam("instituteId") String instituteId) {

        return learnerProfileManager.getLearnerInfo(user, instituteId);
    }
}
