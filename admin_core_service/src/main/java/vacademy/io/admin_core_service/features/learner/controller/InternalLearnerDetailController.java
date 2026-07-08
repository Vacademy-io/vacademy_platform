package vacademy.io.admin_core_service.features.learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner.service.LearnerLmsUserSyncService;
import vacademy.io.admin_core_service.features.learner.service.LearnerService;
import vacademy.io.common.auth.dto.UserDTO;

@RestController
@RequestMapping("/admin-core-service/internal/learner/v1")
public class InternalLearnerDetailController {

    @Autowired
    private LearnerService learnerService;

    @Autowired
    private LearnerLmsUserSyncService learnerLmsUserSyncService;

    @PutMapping("/update")
    public ResponseEntity<String> updateLearnerDetail(@RequestBody UserDTO userDTO){
        return ResponseEntity.ok(learnerService.updateLearnerDetail(userDTO));
    }

    /**
     * Mirrors a learner's newly-changed portal password to any WordPress LMS their
     * courses are connected to. Called by auth_service after a password update.
     * The sync itself is @Async + best-effort, so this returns immediately.
     */
    @PostMapping("/sync-lms-password")
    public ResponseEntity<String> syncLmsPassword(@RequestBody UserDTO userDTO){
        learnerLmsUserSyncService.syncPasswordUpdate(
                userDTO.getId(), userDTO.getEmail(), userDTO.getPassword());
        return ResponseEntity.ok("triggered");
    }
}
