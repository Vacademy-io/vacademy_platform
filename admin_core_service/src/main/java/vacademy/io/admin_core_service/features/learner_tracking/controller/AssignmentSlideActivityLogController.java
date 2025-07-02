package vacademy.io.admin_core_service.features.learner_tracking.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.service.AssignmentSlideActivityLogService;
import vacademy.io.admin_core_service.features.learner_tracking.service.QuestionSlideActivityLogService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-tracking/activity-log/assignment-slide")
public class AssignmentSlideActivityLogController {
    @Autowired
    private AssignmentSlideActivityLogService assignmentSlideActivityLogService;

    @PostMapping("/add-or-update-assignment-slide-activity-log")
    public ResponseEntity<String> addOrUpdateAssignmentSlideActivityLog(@RequestBody ActivityLogDTO activityLogDTO,
                                                                        String slideId,
                                                                        String chapterId,
                                                                        String moduleId,
                                                                        String subjectId,
                                                                        String packageSessionId,
                                                                        String userId,
                                                                        @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(assignmentSlideActivityLogService.addOrUpdateAssignmentSlideSlideActivityLog(activityLogDTO, slideId,chapterId,moduleId,subjectId,packageSessionId, userId, user));
    }

    @GetMapping("/assignment-slide-activity-logs")
    public ResponseEntity<Page<ActivityLogDTO>> getVideoQuestionActivityLogs(
            @RequestParam("userId") String userId,
            @RequestParam("slideId") String slideId,
            @RequestParam(value = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER, required = false) int pageNo,
            @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        return ResponseEntity.ok(assignmentSlideActivityLogService.getAssignmentSlideActivityLogs(userId, slideId, PageRequest.of(pageNo, pageSize), userDetails));
    }

}
