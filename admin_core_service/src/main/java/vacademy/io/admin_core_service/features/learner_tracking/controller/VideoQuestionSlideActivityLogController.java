package vacademy.io.admin_core_service.features.learner_tracking.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.service.VideoSlideQuestionTrackingService;
import vacademy.io.common.auth.config.PageConstants;
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

    @GetMapping("/learner-video-question-activity-logs")
    public ResponseEntity<Page<ActivityLogDTO>> getVideoQuestionActivityLogs(
            @RequestParam("userId") String userId,
            @RequestParam("slideId") String slideId,
            @RequestParam(value = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER, required = false) int pageNo,
            @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        return ResponseEntity.ok(videoSlideQuestionTrackingService.getVideoSlideQuestionActivityLogs(userId, slideId, PageRequest.of(pageNo, pageSize), userDetails));
    }
}
