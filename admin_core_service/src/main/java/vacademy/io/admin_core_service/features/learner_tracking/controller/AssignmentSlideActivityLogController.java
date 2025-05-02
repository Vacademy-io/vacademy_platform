package vacademy.io.admin_core_service.features.learner_tracking.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.service.AssignmentSlideActivityLogService;
import vacademy.io.admin_core_service.features.learner_tracking.service.QuestionSlideActivityLogService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-tracking/activity-log/assignment-slide")
public class AssignmentSlideActivityLogController {
    @Autowired
    private AssignmentSlideActivityLogService assignmentSlideActivityLogService;

    @PostMapping("/add-or-update-assignment-slide-activity-log")
    public ResponseEntity<String> addOrUpdateAssignmentSlideActivityLog(@RequestBody ActivityLogDTO activityLogDTO, String slideId, String userId,@RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(assignmentSlideActivityLogService.addOrUpdateAssignmentSlideSlideActivityLog(activityLogDTO, slideId, userId, user));
    }

}
