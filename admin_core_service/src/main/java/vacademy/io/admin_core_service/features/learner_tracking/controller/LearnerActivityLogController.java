package vacademy.io.admin_core_service.features.learner_tracking.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogFilterDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.DailyTimeSpentProjection;
import vacademy.io.admin_core_service.features.learner_tracking.service.LearnerActivityDetailService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/learner-tracking/activity-log/learner/v1")
@RequiredArgsConstructor
public class LearnerActivityLogController {
    private final LearnerActivityDetailService learnerActivityDetailService;

    @PostMapping("/daily-time-spent")
    public ResponseEntity<List<DailyTimeSpentProjection>>getDailyTimeSpentByLearner(@RequestBody ActivityLogFilterDTO activityLogFilterDTO, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerActivityDetailService.getLearnerAndBatchTimeSpent(activityLogFilterDTO, user));
    }
}
