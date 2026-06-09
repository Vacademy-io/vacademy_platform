package vacademy.io.admin_core_service.features.sales_dashboard.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.counsellor_rating.dto.LeaderboardEntryDTO;
import vacademy.io.admin_core_service.features.sales_dashboard.dto.*;
import vacademy.io.admin_core_service.features.sales_dashboard.service.SalesDashboardService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.sql.Timestamp;
import java.util.List;

/**
 * Sales dashboard endpoints. Each maps to one widget on /sales-dashboard so
 * payloads stay small and individual widgets can refresh independently from
 * the React Query cache.
 *
 * RBAC: the gateway/auth layer already gates each path by permission tag;
 * SALES_DASHBOARD_VIEW lets callers fetch their own team's data, while
 * SALES_DASHBOARD_VIEW_ALL_TEAMS allows the team_id parameter to be omitted
 * for institute-wide aggregates.
 */
@RestController
@RequestMapping("/admin-core-service/v1/sales-dashboard")
@RequiredArgsConstructor
public class SalesDashboardController {

    private final SalesDashboardService service;

    @GetMapping("/kpi")
    public ResponseEntity<KpiDTO> kpi(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "team_id", required = false) String teamId,
            @RequestParam(value = "from", required = false) Long fromMillis,
            @RequestParam(value = "to", required = false) Long toMillis,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(service.kpi(instituteId, teamId,
                ts(fromMillis), ts(toMillis), user.getUserId()));
    }

    @GetMapping("/conversion-funnel")
    public ResponseEntity<List<FunnelStageDTO>> conversionFunnel(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "team_id", required = false) String teamId,
            @RequestParam(value = "from", required = false) Long fromMillis,
            @RequestParam(value = "to", required = false) Long toMillis,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(service.conversionFunnel(instituteId, teamId,
                ts(fromMillis), ts(toMillis), user.getUserId()));
    }

    @GetMapping("/reassignments")
    public ResponseEntity<List<TimeSeriesPointDTO>> reassignments(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "from", required = false) Long fromMillis,
            @RequestParam(value = "to", required = false) Long toMillis) {
        // Default to last 30 days when range is omitted.
        long now = System.currentTimeMillis();
        Timestamp from = fromMillis != null ? new Timestamp(fromMillis) : new Timestamp(now - 30L * 86_400_000);
        Timestamp to = toMillis != null ? new Timestamp(toMillis) : new Timestamp(now);
        return ResponseEntity.ok(service.reassignmentSeries(instituteId, from, to));
    }

    @GetMapping("/upcoming-followups")
    public ResponseEntity<List<FollowupRowDTO>> upcomingFollowups(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "team_id", required = false) String teamId,
            @RequestParam(value = "hours_ahead", defaultValue = "48") int hoursAhead,
            @RequestParam(value = "limit", defaultValue = "20") int limit,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(service.upcomingFollowups(instituteId, teamId, hoursAhead, limit, user.getUserId()));
    }

    @GetMapping("/missed-followups")
    public ResponseEntity<List<FollowupRowDTO>> missedFollowups(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "team_id", required = false) String teamId,
            @RequestParam(value = "limit", defaultValue = "20") int limit,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(service.missedFollowups(instituteId, teamId, limit, user.getUserId()));
    }

    @GetMapping("/new-vs-existing")
    public ResponseEntity<List<TimeSeriesPointDTO>> newVsExisting(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "team_id", required = false) String teamId,
            @RequestParam(value = "from", required = false) Long fromMillis,
            @RequestParam(value = "to", required = false) Long toMillis,
            @RequestAttribute("user") CustomUserDetails user) {
        long now = System.currentTimeMillis();
        Timestamp from = fromMillis != null ? new Timestamp(fromMillis) : new Timestamp(now - 30L * 86_400_000);
        Timestamp to = toMillis != null ? new Timestamp(toMillis) : new Timestamp(now);
        return ResponseEntity.ok(service.newVsExisting(instituteId, teamId, from, to, user.getUserId()));
    }

    @GetMapping("/conversion-by-source")
    public ResponseEntity<List<SourceConversionDTO>> conversionBySource(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "team_id", required = false) String teamId,
            @RequestParam(value = "counsellor_user_id", required = false) String counsellorUserId,
            @RequestParam(value = "from", required = false) Long fromMillis,
            @RequestParam(value = "to", required = false) Long toMillis,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(service.conversionBySource(instituteId, teamId,
                ts(fromMillis), ts(toMillis), user.getUserId(), counsellorUserId));
    }

    @GetMapping("/calls-per-day")
    public ResponseEntity<List<TimeSeriesPointDTO>> callsPerDay(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "team_id", required = false) String teamId,
            @RequestParam(value = "counsellor_user_id", required = false) String counsellorUserId,
            @RequestParam(value = "from", required = false) Long fromMillis,
            @RequestParam(value = "to", required = false) Long toMillis,
            @RequestAttribute("user") CustomUserDetails user) {
        long now = System.currentTimeMillis();
        Timestamp from = fromMillis != null ? new Timestamp(fromMillis) : new Timestamp(now - 30L * 86_400_000);
        Timestamp to = toMillis != null ? new Timestamp(toMillis) : new Timestamp(now);
        return ResponseEntity.ok(service.callsPerDay(instituteId, teamId, from, to, user.getUserId(), counsellorUserId));
    }

    @GetMapping("/campaign-cards")
    public ResponseEntity<List<CampaignCardDTO>> campaignCards(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "period", defaultValue = "WEEK") String period) {
        return ResponseEntity.ok(service.campaignCards(instituteId, period));
    }

    @GetMapping("/counsellor-leaderboard")
    public ResponseEntity<List<LeaderboardEntryDTO>> counsellorLeaderboard(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "team_id", required = false) String teamId,
            @RequestParam(value = "limit", defaultValue = "10") int limit) {
        return ResponseEntity.ok(service.counsellorLeaderboard(instituteId, teamId, limit));
    }

    @GetMapping("/insights")
    public ResponseEntity<List<InsightDTO>> insights(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "team_id", required = false) String teamId) {
        return ResponseEntity.ok(service.insights(instituteId, teamId));
    }

    private static Timestamp ts(Long millis) {
        return millis != null ? new Timestamp(millis) : null;
    }
}
