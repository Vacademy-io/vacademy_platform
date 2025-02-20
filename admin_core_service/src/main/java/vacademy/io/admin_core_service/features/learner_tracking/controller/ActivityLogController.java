package vacademy.io.admin_core_service.features.learner_tracking.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.LearnerActivityProjection;
import vacademy.io.admin_core_service.features.learner_tracking.service.ActivityLogService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.constants.PageConstants;

@RestController
@RequestMapping("/admin-core-service/learner-tracking/activity-log/v1")
@RequiredArgsConstructor
public class ActivityLogController {
    private final ActivityLogService activityLogService;

    @GetMapping("/learner-activity")
    public ResponseEntity<Page<LearnerActivityProjection>> getStudentActivity(
            @RequestParam String slideId,
            @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int page,
            @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int size,
            @RequestAttribute("user")CustomUserDetails user) {

        Page<LearnerActivityProjection> studentActivities = activityLogService.getStudentActivityBySlide(slideId, page, size,user);
        return ResponseEntity.ok(studentActivities);
    }

}
