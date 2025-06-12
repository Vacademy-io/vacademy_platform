package vacademy.io.admin_core_service.features.learner_tracking.controller;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.service.LearnerTrackingService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-tracking/v1")
public class LearnerTrackingController {

    private final LearnerTrackingService learnerTrackingService;

    public LearnerTrackingController(LearnerTrackingService learnerTrackingService) {
        this.learnerTrackingService = learnerTrackingService;
    }

    @PostMapping("/add-or-update-document-activity")
    public ResponseEntity<ActivityLogDTO> addDocumentActivityLog(
            @RequestBody ActivityLogDTO activityLogDTO,
            @RequestParam String slideId,
            @RequestParam String chapterId,
            @RequestParam String packageSessionId,
            @RequestParam String moduleId,
            @RequestParam String subjectId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerTrackingService.addOrUpdateDocumentActivityLog(
                activityLogDTO,
                slideId,
                chapterId,
                packageSessionId,
                moduleId,
                subjectId,
                user));
    }

    @PostMapping("/add-or-update-video-activity")
    public ResponseEntity<ActivityLogDTO> addVideoActivityLog(
            @RequestBody ActivityLogDTO activityLogDTO,
            @RequestParam String slideId,
            @RequestParam String chapterId,
            @RequestParam String packageSessionId,
            @RequestParam String moduleId,
            @RequestParam String subjectId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerTrackingService.addOrUpdateVideoActivityLog(activityLogDTO, slideId, chapterId,moduleId, subjectId, packageSessionId, user));
    }

    @GetMapping("/get-learner-document-activity-logs")
    public Page<ActivityLogDTO> getDocumentActivityLogs(
            @RequestParam("userId") String userId,
            @RequestParam("slideId") String slideId,
            @RequestParam(value = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER, required = false) int pageNo,
            @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        return learnerTrackingService.getDocumentActivityLogs(userId, slideId, PageRequest.of(pageNo, pageSize), userDetails);
    }


    @GetMapping("/get-learner-video-activity-logs")
    public Page<ActivityLogDTO> getVideoActivityLogs(
            @RequestParam("userId") String userId,
            @RequestParam("slideId") String slideId,
            @RequestParam(value = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER, required = false) int pageNo,
            @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        return learnerTrackingService.getDocumentActivityLogs(userId, slideId, PageRequest.of(pageNo, pageSize), userDetails);
    }
}