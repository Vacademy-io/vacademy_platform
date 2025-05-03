package vacademy.io.admin_core_service.features.learner_tracking.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.service.VideoSlideQuestionTrackingService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-tracking/activity-log/video-question-slide")
public class VideoQuestionSlideActivityLogController {

    @Autowired
    private VideoSlideQuestionTrackingService videoSlideQuestionTrackingService;

    @PostMapping("/add-or-update")
    public ResponseEntity<String> addOrUpdateVideoQuestionSlideActivityLog(
            @RequestBody ActivityLogDTO activityLogDTO,
            @RequestParam String slideId,
            @RequestParam String userId,
            @RequestAttribute("user") CustomUserDetails user
    ) {
        String activityId = videoSlideQuestionTrackingService.saveOrUpdateVideoSlideQuestionLogs(
                activityLogDTO, slideId, userId, user);
        return ResponseEntity.ok(activityId);
    }
}
