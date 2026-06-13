package vacademy.io.admin_core_service.features.audience.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.audience.dto.reports.TeamRollupReportDTO;
import vacademy.io.admin_core_service.features.audience.service.ManagerReportService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Manager-facing team-rollup report endpoint for the Reports Center (Manager tab).
 * Sibling of {@link PipelineReportController} / {@link LeadReportController} — same base path,
 * same param conventions (fromDate/toDate as yyyy-MM-dd in the INSTITUTE timezone; both optional,
 * defaulting to the last 30 days), same RBAC spirit (a scoped caller — inside the leads subtree —
 * only sees teams/members within their descendants; a non-scoped admin sees every team under the
 * reporting root).
 */
@RestController
@RequestMapping("/admin-core-service/v1/reports")
@RequiredArgsConstructor
public class ManagerReportController {

    private final ManagerReportService managerReportService;

    /** Per-team aggregate performance: counsellors, leads, conversions, target attainment. */
    @GetMapping("/team-rollup")
    public ResponseEntity<TeamRollupReportDTO> getTeamRollup(
            @RequestParam String instituteId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String teamId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(managerReportService.getTeamRollup(
                instituteId, fromDate, toDate, teamId, user.getUserId()));
    }
}
