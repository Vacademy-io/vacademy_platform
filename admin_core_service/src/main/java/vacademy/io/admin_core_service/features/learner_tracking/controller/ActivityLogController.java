package vacademy.io.admin_core_service.features.learner_tracking.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.LearnerActivityProjection;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.learner_tracking.service.ActivityLogService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.constants.PageConstants;

@RestController
@RequestMapping("/admin-core-service/learner-tracking/activity-log/v1")
@RequiredArgsConstructor
public class ActivityLogController {
    private final ActivityLogService activityLogService;
    private final ActivityLogRepository activityLogRepository;

    /**
     * @param search optional free-text filter on the learner (name, email, username, mobile).
     *               Applied in SQL across the whole batch, so a match on any page is found.
     */
    @GetMapping("/learner-activity")
    public ResponseEntity<Page<LearnerActivityProjection>> getStudentActivity(
            @RequestParam String slideId,
            @RequestParam(required = false) String packageSessionId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int page,
            @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int size,
            @RequestAttribute("user") CustomUserDetails user) {

        Page<LearnerActivityProjection> studentActivities = activityLogService.getStudentActivityBySlide(slideId, packageSessionId, search, page, size, user);
        return ResponseEntity.ok(studentActivities);
    }

    /**
     * Presence heartbeat from the learner app: keeps the learner "present" on this slide even when
     * no tracking write is happening (paused video/audio, static reading). Fired every ~60s while
     * the slide is open and the tab is visible; stops when they leave, so they go OFFLINE naturally.
     */
    @PostMapping("/presence-heartbeat")
    public ResponseEntity<Void> presenceHeartbeat(
            @RequestParam String slideId,
            @RequestAttribute("user") CustomUserDetails user) {
        activityLogRepository.touchPresence(user.getUserId(), slideId);
        return ResponseEntity.ok().build();
    }

}
