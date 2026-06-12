package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import vacademy.io.admin_core_service.features.audience.dto.CounselorPerformanceDTO;
import vacademy.io.admin_core_service.features.audience.dto.LeadReportProjections;
import vacademy.io.admin_core_service.features.audience.dto.LeadReportSummaryDTO;
import vacademy.io.admin_core_service.features.audience.dto.LeadSlaConfigDTO;
import vacademy.io.admin_core_service.features.audience.entity.LeadStatus;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadStatusRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.auth_service.service.OrganizationTeamAuthClient;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.CounsellorScopeService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.organization.OrgTeamDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Builds the two read-only Lead Reports endpoints: a summary (KPIs + breakdowns + daily trend)
 * and per-counsellor performance. Pure aggregation over existing tables — never writes anything,
 * so it can never break any business rule. Date range defaults to the last 30 days when omitted.
 *
 * Every report is RBAC-scoped to the caller via {@link CounsellorScopeService} (same rules as
 * the sales dashboard — see {@link #resolveScopeUserIds}), and optionally narrowed by team,
 * counsellor, audience/campaign and source-type dimensions.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LeadReportService {

    private final AudienceResponseRepository audienceResponseRepository;
    private final LeadStatusRepository leadStatusRepository;
    private final LeadSlaConfigService leadSlaConfigService;
    private final AuthService authService;
    private final CounsellorScopeService counsellorScopeService;
    private final OrganizationTeamAuthClient orgTeamClient;

    private static final int DEFAULT_RANGE_DAYS = 30;

    // ─────────────────────────────────────────────────────────────────────
    // Lead Reports — summary
    // ─────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public LeadReportSummaryDTO getLeadSummary(String instituteId, String fromDate, String toDate,
                                               String teamId, String counsellorUserId,
                                               String audienceId, String sourceType,
                                               String callerUserId) {
        DateRange range = resolveRange(fromDate, toDate);
        Integer tatHours = resolveTatHours(instituteId); // null when TAT disabled
        Integer tatHoursParam = tatHours != null ? tatHours : 0;

        String scopeCsv = toScopeCsv(resolveScopeUserIds(
                instituteId, callerUserId, trimToNull(teamId), trimToNull(counsellorUserId)));
        String audienceFilter = trimToNull(audienceId);
        String sourceFilter = trimToNull(sourceType);

        LeadReportProjections.TotalsProjection totals =
                audienceResponseRepository.findReportTotals(instituteId, range.from, range.to,
                        scopeCsv, audienceFilter, sourceFilter);
        LeadReportProjections.ResponseStatsProjection response =
                audienceResponseRepository.findReportResponseStats(instituteId, range.from, range.to, tatHoursParam,
                        scopeCsv, audienceFilter, sourceFilter);
        List<LeadReportProjections.StatusCountProjection> statusRows =
                audienceResponseRepository.findReportStatusBreakdown(instituteId, range.from, range.to,
                        scopeCsv, audienceFilter, sourceFilter);
        List<LeadReportProjections.SourceCountProjection> sourceRows =
                audienceResponseRepository.findReportSourceBreakdown(instituteId, range.from, range.to,
                        scopeCsv, audienceFilter, sourceFilter);
        List<LeadReportProjections.TierCountProjection> tierRows =
                audienceResponseRepository.findReportTierBreakdown(instituteId, range.from, range.to,
                        scopeCsv, audienceFilter, sourceFilter);
        List<LeadReportProjections.DailyTrendProjection> trendRows =
                audienceResponseRepository.findReportDailyTrend(instituteId, range.from, range.to,
                        scopeCsv, audienceFilter, sourceFilter);

        long total = nz(totals != null ? totals.getTotalLeads() : null);
        long converted = nz(totals != null ? totals.getConvertedLeads() : null);
        long lost = nz(totals != null ? totals.getLostLeads() : null);
        long active = nz(totals != null ? totals.getActiveLeads() : null);
        long overdue = nz(totals != null ? totals.getOverdueLeads() : null);
        long responded = nz(response != null ? response.getRespondedLeads() : null);
        Double avgResponseMin = response != null ? response.getAvgResponseMinutes() : null;
        Long tatMet = (tatHours == null || response == null) ? null : response.getTatMetCount();

        LeadReportSummaryDTO.Totals totalsDto = LeadReportSummaryDTO.Totals.builder()
                .totalLeads(total)
                .convertedLeads(converted)
                .lostLeads(lost)
                .activeLeads(active)
                .conversionRate(percentage(converted, total))
                .respondedLeads(responded)
                .avgResponseMinutes(avgResponseMin)
                .tatMetCount(tatMet)
                .tatMetRate(tatMet == null ? null : percentage(tatMet, responded))
                .overdueLeads(overdue)
                .build();

        // Resolve status_key → (label, color) from the catalog so the FE doesn't need a second call.
        Map<String, LeadStatus> catalog = leadStatusRepository
                .findByInstituteIdAndIsActiveTrueOrderByDisplayOrderAsc(instituteId).stream()
                .collect(Collectors.toMap(LeadStatus::getStatusKey, s -> s, (a, b) -> a));

        List<LeadReportSummaryDTO.StatusBreakdown> statusBreakdown = statusRows.stream()
                .map(r -> {
                    LeadStatus s = catalog.get(r.getStatusKey());
                    return LeadReportSummaryDTO.StatusBreakdown.builder()
                            .statusKey(r.getStatusKey())
                            .label(s != null ? s.getLabel() : r.getStatusKey())
                            .color(s != null ? s.getColor() : null)
                            .count(nz(r.getLeadCount()))
                            .build();
                })
                .collect(Collectors.toList());

        List<LeadReportSummaryDTO.SourceBreakdown> sourceBreakdown = sourceRows.stream()
                .map(r -> LeadReportSummaryDTO.SourceBreakdown.builder()
                        .sourceType(r.getSourceType())
                        .total(nz(r.getTotalCount()))
                        .converted(nz(r.getConvertedCount()))
                        .build())
                .collect(Collectors.toList());

        List<LeadReportSummaryDTO.TierBreakdown> tierBreakdown = tierRows.stream()
                .map(r -> LeadReportSummaryDTO.TierBreakdown.builder()
                        .tier(r.getTier())
                        .count(nz(r.getLeadCount()))
                        .build())
                .collect(Collectors.toList());

        List<LeadReportSummaryDTO.DailyTrendPoint> trend = trendRows.stream()
                .map(r -> LeadReportSummaryDTO.DailyTrendPoint.builder()
                        .date(r.getDay() != null ? r.getDay().toString() : null)
                        .submitted(nz(r.getSubmittedCount()))
                        .converted(nz(r.getConvertedCount()))
                        .build())
                .collect(Collectors.toList());

        return LeadReportSummaryDTO.builder()
                .fromDate(range.from)
                .toDate(range.to)
                .totals(totalsDto)
                .byStatus(statusBreakdown)
                .bySource(sourceBreakdown)
                .byTier(tierBreakdown)
                .trendByDay(trend)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Counsellor performance
    // ─────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public CounselorPerformanceDTO getCounselorPerformance(String instituteId, String fromDate, String toDate,
                                                           String teamId, String counsellorUserId,
                                                           String audienceId, String sourceType,
                                                           String callerUserId) {
        DateRange range = resolveRange(fromDate, toDate);
        Integer tatHours = resolveTatHours(instituteId);
        Integer tatHoursParam = tatHours != null ? tatHours : 0;

        String scopeCsv = toScopeCsv(resolveScopeUserIds(
                instituteId, callerUserId, trimToNull(teamId), trimToNull(counsellorUserId)));

        List<LeadReportProjections.CounselorRowProjection> raw = audienceResponseRepository
                .findReportCounselorPerformance(instituteId, range.from, range.to, tatHoursParam,
                        scopeCsv, trimToNull(audienceId), trimToNull(sourceType));

        // Batch-resolve counsellor names (one call to auth-service for all ids in the result).
        Map<String, String> nameById = Collections.emptyMap();
        List<String> ids = raw.stream().map(LeadReportProjections.CounselorRowProjection::getCounselorId)
                .filter(s -> s != null && !s.isBlank()).distinct().collect(Collectors.toList());
        if (!ids.isEmpty()) {
            try {
                List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(ids);
                if (!CollectionUtils.isEmpty(users)) {
                    nameById = users.stream().filter(u -> u != null && u.getId() != null)
                            .collect(Collectors.toMap(UserDTO::getId, UserDTO::getFullName, (a, b) -> a));
                }
            } catch (Exception ex) {
                log.warn("[LeadReport] Failed to resolve counsellor names: {}", ex.getMessage());
            }
        }

        final Map<String, String> nameByIdFinal = nameById;
        List<CounselorPerformanceDTO.Row> rows = raw.stream().map(r -> {
            long assigned = nz(r.getLeadsAssigned());
            long responded = nz(r.getLeadsResponded());
            long conversions = nz(r.getConversions());
            Long tatMet = tatHours == null ? null : r.getTatMetCount();
            return CounselorPerformanceDTO.Row.builder()
                    .counselorId(r.getCounselorId())
                    .counselorName(Optional.ofNullable(nameByIdFinal.get(r.getCounselorId()))
                            .filter(s -> !s.isBlank())
                            .orElse(r.getCounselorId()))
                    .leadsAssigned(assigned)
                    .leadsResponded(responded)
                    .conversions(conversions)
                    .conversionRate(percentage(conversions, assigned))
                    .avgResponseMinutes(r.getAvgResponseMinutes())
                    .tatMetCount(tatMet)
                    .tatMetRate(tatMet == null ? null : percentage(tatMet, responded))
                    .openLeads(nz(r.getOpenLeads()))
                    .overdueLeads(nz(r.getOverdueLeads()))
                    .build();
        }).collect(Collectors.toList());

        // Summary: weighted averages so a few heavy counsellors don't get equal weight to outliers.
        long totalAssigned = rows.stream().mapToLong(CounselorPerformanceDTO.Row::getLeadsAssigned).sum();
        long totalConversions = rows.stream().mapToLong(CounselorPerformanceDTO.Row::getConversions).sum();
        double avgResponseWeighted = weightedAvg(
                rows.stream().filter(r -> r.getAvgResponseMinutes() != null && r.getLeadsResponded() > 0)
                        .collect(Collectors.toList()),
                r -> r.getAvgResponseMinutes(),
                r -> (double) r.getLeadsResponded());

        CounselorPerformanceDTO.Summary summary = CounselorPerformanceDTO.Summary.builder()
                .totalCounselors(rows.size())
                .avgResponseMinutes(Double.isNaN(avgResponseWeighted) ? null : avgResponseWeighted)
                .avgConversionRate(totalAssigned == 0 ? null : (totalConversions * 100.0) / totalAssigned)
                .build();

        return CounselorPerformanceDTO.builder()
                .fromDate(range.from)
                .toDate(range.to)
                .tatHours(tatHours)
                .rows(rows)
                .summary(summary)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────
    // RBAC scope resolution
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Resolve the counsellor-user whitelist this report should aggregate over.
     * Mirrors SalesDashboardService.scopedUsers, with explicit narrowing on top.
     *
     * Priority:
     *   1. Explicit {@code counsellorUserId} → that single counsellor. When the
     *      caller is themselves inside the leads subtree, the target must sit
     *      inside their RBAC descendants — 403 otherwise.
     *   2. Explicit {@code teamId} → all users across that team's subtree,
     *      intersected with the caller's RBAC scope when the caller is scoped.
     *   3. Caller inside the leads subtree → their RBAC descendants. A leaf
     *      counsellor resolves to just themselves — self-scoped reports are the
     *      chosen product behavior.
     *   4. Admin outside the leads subtree → everyone under the leads root.
     *   5. Leads team not configured → null = institute-wide (admin setup mode).
     *
     * Returns null for "no scope filter". A non-empty list MUST be applied; an
     * EMPTY list means "scoped to nothing" — the report comes back zeroed rather
     * than silently widening back to institute-wide.
     */
    private List<String> resolveScopeUserIds(String instituteId, String callerUserId,
                                             String teamId, String counsellorUserId) {
        boolean callerScoped = counsellorScopeService.isCallerInLeadsSubtree(instituteId, callerUserId);
        List<String> callerScope = callerScoped
                ? counsellorScopeService.descendantUserIdsForCaller(instituteId, callerUserId)
                : Collections.emptyList();

        if (counsellorUserId != null) {
            if (callerScoped && !callerScope.contains(counsellorUserId)) {
                throw new VacademyException(HttpStatus.FORBIDDEN,
                        "You are not allowed to view reports for this counsellor.");
            }
            return List.of(counsellorUserId);
        }

        if (teamId != null) {
            List<String> subtreeTeamIds = orgTeamClient.getSubtreeIncludingSelf(teamId).stream()
                    .map(OrgTeamDTO::getId).collect(Collectors.toList());
            List<String> teamUsers = counsellorScopeService.usersInTeams(subtreeTeamIds);
            if (callerScoped) {
                Set<String> allowed = new HashSet<>(callerScope);
                teamUsers = teamUsers.stream().filter(allowed::contains).collect(Collectors.toList());
            }
            return teamUsers; // possibly empty → zeroed report, never silently unscoped
        }

        if (callerScoped && !callerScope.isEmpty()) {
            return callerScope;
        }

        List<String> leadsTeamIds = counsellorScopeService.allTeamIdsUnderLeadsRoot(instituteId);
        if (leadsTeamIds.isEmpty()) return null; // admin setup mode — no scope filter
        List<String> users = counsellorScopeService.usersInTeams(leadsTeamIds);
        return users.isEmpty() ? null : users;
    }

    /**
     * null scope → null bind (no filter). EMPTY scope → "" — STRING_TO_ARRAY('', ',')
     * is the empty array, so every row fails the scope predicate and the report comes
     * back zeroed through the normal query path.
     */
    private static String toScopeCsv(List<String> scope) {
        return scope == null ? null : String.join(",", scope);
    }

    private static String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    /** Read tat_hours when TAT is enabled; null otherwise (drives "is TAT shown?" downstream). */
    private Integer resolveTatHours(String instituteId) {
        try {
            LeadSlaConfigDTO sla = leadSlaConfigService.getSchedulerConfig(instituteId);
            if (sla != null && sla.getTatReminder() != null && sla.getTatReminder().isEnabled()) {
                return sla.getTatReminder().getTatHours();
            }
        } catch (Exception ex) {
            log.debug("[LeadReport] No SLA config for institute {}: {}", instituteId, ex.getMessage());
        }
        return null;
    }

    /** Parse [from, to] as ISO yyyy-MM-dd; default to last 30 days. Returns the server-TZ timestamp strings. */
    private DateRange resolveRange(String fromDate, String toDate) {
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.now(zone);
        LocalDate to = parseOr(toDate, today);
        LocalDate from = parseOr(fromDate, to.minusDays(DEFAULT_RANGE_DAYS - 1L));
        // Inclusive-of-day on both ends; query uses '<' on the upper bound so add a day.
        return new DateRange(
                from.atStartOfDay().toString(),
                to.plusDays(1).atStartOfDay().toString());
    }

    private static LocalDate parseOr(String iso, LocalDate fallback) {
        if (iso == null || iso.isBlank()) return fallback;
        try { return LocalDate.parse(iso); } catch (Exception e) { return fallback; }
    }

    private static long nz(Long v) { return v == null ? 0L : v; }

    /** numerator/denominator * 100, rounded to one decimal; null when denominator is 0. */
    private static Double percentage(long num, long denom) {
        if (denom == 0) return null;
        return Math.round((num * 1000.0) / denom) / 10.0;
    }

    /** Sum(value * weight) / Sum(weight). Returns NaN when total weight is 0. */
    private static <T> double weightedAvg(List<T> rows,
                                          java.util.function.Function<T, Double> value,
                                          java.util.function.Function<T, Double> weight) {
        double num = 0, den = 0;
        for (T r : rows) {
            Double v = value.apply(r); Double w = weight.apply(r);
            if (v == null || w == null) continue;
            num += v * w; den += w;
        }
        return den == 0 ? Double.NaN : (num / den);
    }

    private record DateRange(String from, String to) {
        // ISO LocalDateTime strings the native query CASTs to timestamp.
    }

    /** Local DateTime helper kept for future use if we want UTC casts. */
    @SuppressWarnings("unused")
    private static LocalDateTime startOfDay(LocalDate d) {
        return d.atStartOfDay();
    }
}
