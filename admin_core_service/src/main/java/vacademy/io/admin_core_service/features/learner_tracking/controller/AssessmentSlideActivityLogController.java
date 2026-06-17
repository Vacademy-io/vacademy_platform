package vacademy.io.admin_core_service.features.learner_tracking.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.service.AssessmentSlideActivityLogService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-tracking/activity-log/assessment-slide")
public class AssessmentSlideActivityLogController {

    @Autowired
    private AssessmentSlideActivityLogService assessmentSlideActivityLogService;

    @PostMapping("/add-or-update-assessment-slide-activity-log")
    public ResponseEntity<String> addOrUpdateAssessmentSlideActivityLog(@RequestBody ActivityLogDTO activityLogDTO,
                                                                        @RequestParam("slideId") String slideId,
                                                                        @RequestAttribute("user") CustomUserDetails user) {
        // The submitter is always the authenticated learner — don't trust a
        // client-supplied user id for self-submission.
        return ResponseEntity.ok(assessmentSlideActivityLogService
                .addOrUpdateAssessmentSlideActivityLog(activityLogDTO, slideId, user.getUserId(), user));
    }

    @GetMapping("/assessment-slide-activity-logs")
    public ResponseEntity<Page<ActivityLogDTO>> getAssessmentSlideActivityLogs(
            @RequestParam("userId") String userId,
            @RequestParam("slideId") String slideId,
            @RequestParam(value = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER, required = false) int pageNo,
            @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        return ResponseEntity.ok(assessmentSlideActivityLogService
                .getAssessmentSlideActivityLogs(userId, slideId, PageRequest.of(pageNo, pageSize), userDetails));
    }
}
