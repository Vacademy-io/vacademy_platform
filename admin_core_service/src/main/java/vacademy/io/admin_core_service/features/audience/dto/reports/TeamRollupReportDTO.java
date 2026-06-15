package vacademy.io.admin_core_service.features.audience.dto.reports;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * GET /v1/reports/team-rollup — per-team aggregate performance so a manager can compare
 * sub-teams head-to-head. One row per reporting team (the flat teams under the reporting
 * root), each summing its members' counsellor-performance numbers; plus an institute-wide
 * (or root-wide) totals row.
 *
 * <p>Reporting teams = the flat teams in the institute (the org-team model has no sub-team
 * hierarchy — teams are flat, the reporting line lives INSIDE a team via parent_user_id). When
 * the caller passes an explicit teamId the rollup is just that single team. When the caller is
 * RBAC-scoped (inside the leads subtree) the teams/members are narrowed to their descendants,
 * same spirit as ReportScopeResolver; a non-scoped admin sees every team. OPTED_OUT leads are
 * excluded (the underlying per-counsellor aggregate excludes them).
 *
 * <p>Each team row is built by REUSING LeadReportService.getCounselorPerformance scoped to that
 * team and summing its per-counsellor rows. A counsellor who is a member of more than one
 * reporting team is counted in EACH of those teams (membership-based, not de-duplicated across
 * teams), so column sums across teams can exceed the institute totals — the totals row is
 * computed over the union of members, not by summing the team rows.
 *
 * Row semantics:
 *   counsellors      — number of counsellors with leads assigned in-window in this team
 *   leads            — SUM(leadsAssigned) over the team's counsellors
 *   responded        — SUM(leadsResponded)
 *   conversions      — SUM(conversions)
 *   conversion_rate  — conversions / leads as a 0–100 percentage (null when leads = 0)
 *   open             — SUM(openLeads)
 *   overdue          — SUM(overdueLeads)
 *   avg_response_minutes — weighted by responded leads; null when nobody responded
 *   target           — SUM(counselor_pool_member.monthly_target) over the team members, scoped to
 *                      this institute's pools. monthly_target is a per-(pool, audience, counsellor)
 *                      cell, so a counsellor's target sums their per-audience cells. null when every
 *                      member's target is null/unset (no pool config)
 *   attainment_pct   — conversions / target as a 0–100 percentage; null when target is null or 0
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TeamRollupReportDTO {

    private List<Row> teams;
    /** Roll-up over the union of all reportable members; team_id/team_name/head_name are null. */
    private Row totals;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Row {
        private String teamId;        // null on the totals row
        private String teamName;      // null on the totals row
        private String headName;      // team head (parent_user_id IS NULL member), auth-resolved; null on totals
        private long counsellors;
        private long leads;
        private long responded;
        private long conversions;
        private Double conversionRate;       // % 0–100, one decimal; null when leads = 0
        private long open;
        private long overdue;
        private Double avgResponseMinutes;   // weighted by responded leads; null when none responded
        private Long target;                 // SUM(monthly_target); null when all members' targets unset
        private Double attainmentPct;        // % 0–100; null when target is null or 0
    }
}
