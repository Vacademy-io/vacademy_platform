package vacademy.io.admin_core_service.features.audience.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.audience.dto.reports.calling.CallsDailyResponseDTO;
import vacademy.io.admin_core_service.features.audience.dto.reports.calling.CallsHeatmapResponseDTO;
import vacademy.io.admin_core_service.features.audience.dto.reports.calling.FollowupAgingResponseDTO;
import vacademy.io.admin_core_service.features.audience.service.CallingReportService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Read-only telephony + follow-up report endpoints for the Reports Center
 * (Calling and Follow-ups tabs). Same conventions as {@link LeadReportController}:
 * institute-scoped, RBAC-scoped to the caller's leads-subtree visibility (via
 * ReportScopeResolver — counsellor sees self, team head their downstream),
 * date range defaults to the last 30 days, dates are yyyy-MM-dd in the
 * institute timezone, responses are snake_case.
 */
@RestController
@RequestMapping("/admin-core-service/v1/reports")
@RequiredArgsConstructor
public class CallingReportController {

    private final CallingReportService callingReportService;

    /** Daily dials/connects/talk-time series + per-counsellor breakdown with outcome counts. */
    @GetMapping("/calls-daily")
    public ResponseEntity<CallsDailyResponseDTO> getCallsDaily(
            @RequestParam String instituteId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String teamId,
            @RequestParam(required = false) String counsellorUserId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(callingReportService.callsDaily(instituteId, fromDate, toDate,
                teamId, counsellorUserId, user.getUserId()));
    }

    /** Day-of-week × hour dial/connect heatmap cells (institute TZ; empty cells omitted). */
    @GetMapping("/calls-heatmap")
    public ResponseEntity<CallsHeatmapResponseDTO> getCallsHeatmap(
            @RequestParam String instituteId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String teamId,
            @RequestParam(required = false) String counsellorUserId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(callingReportService.callsHeatmap(instituteId, fromDate, toDate,
                teamId, counsellorUserId, user.getUserId()));
    }

    /**
     * Aging buckets over OPEN follow-ups + per-counsellor rows + 30-day closure reasons.
     * Point-in-time: fromDate/toDate are accepted for cross-endpoint signature
     * consistency but intentionally ignored.
     */
    @GetMapping("/followup-aging")
    public ResponseEntity<FollowupAgingResponseDTO> getFollowupAging(
            @RequestParam String instituteId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String teamId,
            @RequestParam(required = false) String counsellorUserId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(callingReportService.followupAging(instituteId,
                teamId, counsellorUserId, user.getUserId()));
    }
}
