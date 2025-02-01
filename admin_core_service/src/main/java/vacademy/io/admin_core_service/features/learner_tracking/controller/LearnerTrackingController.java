package vacademy.io.admin_core_service.features.learner_tracking.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.service.LearnerTrackingService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-tracking/v1")
public class LearnerTrackingController {

    private final LearnerTrackingService learnerTrackingService;

    public LearnerTrackingController(LearnerTrackingService learnerTrackingService) {
        this.learnerTrackingService = learnerTrackingService;
    }

    @PostMapping("/add-document-activity")
    public ResponseEntity<ActivityLogDTO> addDocumentActivityLog(
            @RequestBody ActivityLogDTO activityLogDTO,
            @RequestParam String slideId,
            @RequestParam String userId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerTrackingService.addDocumentActivityLog(activityLogDTO, slideId, userId, user));
    }

    @PostMapping("/add-video-activity")
    public ResponseEntity<ActivityLogDTO> addVideoActivityLog(
            @RequestBody ActivityLogDTO activityLogDTO,
            @RequestParam String slideId,
            @RequestParam String userId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerTrackingService.addVideoActivityLog(activityLogDTO, slideId, userId, user));
    }

    @PutMapping("/update-document-activity/{activityId}")
    public ResponseEntity<ActivityLogDTO> updateDocumentActivityLog(
            @RequestBody ActivityLogDTO activityLogDTO,
            @PathVariable String activityId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerTrackingService.updateDocumentActivityLogs(activityLogDTO, activityId, user));
    }

    @PutMapping("/update-video-activity/{activityId}")
    public ResponseEntity<ActivityLogDTO> updateVideoActivityLog(
            @RequestBody ActivityLogDTO activityLogDTO,
            @PathVariable String activityId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerTrackingService.updateVideoActivityLogs(activityLogDTO, activityId, user));
    }
}
