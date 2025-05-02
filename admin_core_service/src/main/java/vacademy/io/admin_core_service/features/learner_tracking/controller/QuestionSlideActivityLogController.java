package vacademy.io.admin_core_service.features.learner_tracking.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.service.QuestionSlideActivityLogService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-tracking/activity-log/question-slide")
public class QuestionSlideActivityLogController {

    @Autowired
    private QuestionSlideActivityLogService activityLogService;

    @PostMapping("/add-or-update-question-slide-activity-log")
    public ResponseEntity<String> addOrUpdateQuestionSlideActivityLog(@RequestBody ActivityLogDTO activityLogDTO, String slideId, String userId,@RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(activityLogService.addOrUpdateQuestionSlideActivityLog(activityLogDTO, slideId, userId, user));
    }

}
