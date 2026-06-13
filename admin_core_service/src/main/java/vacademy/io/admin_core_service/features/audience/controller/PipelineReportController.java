package vacademy.io.admin_core_service.features.audience.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.audience.dto.reports.DispositionReportDTO;
import vacademy.io.admin_core_service.features.audience.dto.reports.FunnelVelocityReportDTO;
import vacademy.io.admin_core_service.features.audience.dto.reports.SourcePerformanceReportDTO;
import vacademy.io.admin_core_service.features.audience.service.PipelineReportService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * lead_status_history-centric report endpoints for the Reports Center (Sources + Funnel tabs).
 * Sibling of {@link LeadReportController} — same base path, same param conventions
 * (fromDate/toDate as yyyy-MM-dd in the INSTITUTE timezone; both optional, defaulting to the
 * last 30 days), same RBAC scoping (via ReportScopeResolver — a counsellor sees only their own
 * numbers, a team head their subtree; an explicit counsellorUserId outside a scoped caller's
 * descendants is rejected with 403 inside the resolver).
 */
@RestController
@RequestMapping("/admin-core-service/v1/reports")
@RequiredArgsConstructor
public class PipelineReportController {

    private final PipelineReportService pipelineReportService;

    /** Per-source lead quality: volume, connected calls, interest, wins (spend/cpl/roi = Wave 2). */
    @GetMapping("/source-performance")
    public ResponseEntity<SourcePerformanceReportDTO> getSourcePerformance(
            @RequestParam String instituteId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String teamId,
            @RequestParam(required = false) String counsellorUserId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(pipelineReportService.getSourcePerformance(
                instituteId, fromDate, toDate, teamId, counsellorUserId, user.getUserId()));
    }

    /** Per-actor status-change matrix + per-counsellor call outcome counts. */
    @GetMapping("/dispositions")
    public ResponseEntity<DispositionReportDTO> getDispositions(
            @RequestParam String instituteId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String teamId,
            @RequestParam(required = false) String counsellorUserId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(pipelineReportService.getDispositions(
                instituteId, fromDate, toDate, teamId, counsellorUserId, user.getUserId()));
    }

    /** Per-stage throughput + dwell-time medians, plus overall conversion velocity. */
    @GetMapping("/funnel-velocity")
    public ResponseEntity<FunnelVelocityReportDTO> getFunnelVelocity(
            @RequestParam String instituteId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String teamId,
            @RequestParam(required = false) String counsellorUserId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(pipelineReportService.getFunnelVelocity(
                instituteId, fromDate, toDate, teamId, counsellorUserId, user.getUserId()));
    }
}
