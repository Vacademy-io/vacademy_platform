package vacademy.io.admin_core_service.features.audience.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.audience.dto.reports.ActivityTimelineReportDTO;
import vacademy.io.admin_core_service.features.audience.service.ActivityReportService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Read-only counsellor activity-timeline report endpoint for the Reports Center
 * (Activity tab). Same conventions as {@link CallingReportController}:
 * institute-scoped, RBAC-scoped to the caller's leads-subtree visibility (via
 * ReportScopeResolver — counsellor sees self, team head their downstream),
 * date range defaults to the last 30 days, dates are yyyy-MM-dd in the
 * institute timezone, responses are snake_case.
 */
@RestController
@RequestMapping("/admin-core-service/v1/reports")
@RequiredArgsConstructor
public class ActivityReportController {

    private final ActivityReportService activityReportService;

    /** Per-counsellor activity volume by type over the window + a daily total series. */
    @GetMapping("/activity-timeline")
    public ResponseEntity<ActivityTimelineReportDTO> getActivityTimeline(
            @RequestParam String instituteId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String teamId,
            @RequestParam(required = false) String counsellorUserId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(activityReportService.activityTimeline(instituteId, fromDate, toDate,
                teamId, counsellorUserId, user.getUserId()));
    }
}
