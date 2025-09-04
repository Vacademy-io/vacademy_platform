package vacademy.io.admin_core_service.features.learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner.service.LearnerService;
import vacademy.io.common.auth.dto.UserDTO;

@RestController
@RequestMapping("/admin-core-service/internal/learner/v1")
public class InternalLearnerDetailController {

    @Autowired
    private LearnerService learnerService;

    @PutMapping("/update")
    public ResponseEntity<String> updateLearnerDetail(@RequestBody UserDTO userDTO){
        return ResponseEntity.ok(learnerService.updateLearnerDetail(userDTO));
    }
}
