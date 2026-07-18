package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.core.CallDetailService;
import vacademy.io.admin_core_service.features.telephony.core.CallDispositionService;
import vacademy.io.admin_core_service.features.telephony.core.CallDispositionService.AppliedDisposition;
import vacademy.io.admin_core_service.features.telephony.core.CallExportService;
import vacademy.io.admin_core_service.features.telephony.core.CallSearchService;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallDetailDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallDispositionCatalogDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallDispositionRequestDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallMetricsDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallRowDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallSearchFilterDTO;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.io.OutputStreamWriter;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The team calling dashboard surface — a leader (or a single counsellor, by
 * hierarchy) sees calls across their downstream with full filtering.
 * RBAC scope is derived from the caller; provider-agnostic (AI + human, in + out).
 *
 * <p>Aggregate roll-ups (daily series, per-counsellor leaderboard, heatmap,
 * follow-up aging) already live under {@code /v1/reports/calls-*} — this
 * controller is the row-level list those dashboards drill into.
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/calls")
@RequiredArgsConstructor
public class CallDashboardController {

    /** Authority that unmasks phone numbers on the dashboard. Provisioned per-role in auth_service. */
    private static final String VIEW_CALL_NUMBERS = "VIEW_CALL_NUMBERS";

    /** Sync export cap — large enough for routine pulls, async-job path is the v2 follow-up. */
    private static final int EXPORT_CAP = 25_000;

    private final CallSearchService callSearchService;
    private final CallDispositionService callDispositionService;
    private final CallExportService callExportService;
    private final CallDetailService callDetailService;
    private final InstituteAccessValidator instituteAccessValidator;

    @PostMapping("/search")
    public ResponseEntity<Page<CallRowDTO>> search(
            @RequestBody CallSearchFilterDTO filter,
            @RequestAttribute("user") CustomUserDetails user) {
        if (filter == null || filter.getInstituteId() == null || filter.getInstituteId().isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        instituteAccessValidator.validateUserAccess(user, filter.getInstituteId());
        boolean unmask = hasAuthority(user, VIEW_CALL_NUMBERS);
        return ResponseEntity.ok(callSearchService.search(filter, user.getUserId(), unmask));
    }

    /**
     * Deep detail for a single call — the "more details" popover on the Call Log,
     * chiefly to explain a FAILED / BUSY / NO_ANSWER outcome. Surfaces the
     * provider's own hangup/cause/error fields (mined from the stored webhook body),
     * plus price and full timing that the paginated list omits.
     */
    @GetMapping("/{callLogId}/detail")
    public ResponseEntity<CallDetailDTO> detail(
            @PathVariable String callLogId,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        instituteAccessValidator.validateUserAccess(user, instituteId);
        boolean unmask = hasAuthority(user, VIEW_CALL_NUMBERS);
        return ResponseEntity.ok(callDetailService.detail(callLogId, instituteId, unmask));
    }

    /** Call-outcome catalog for the disposition picker + the dashboard's disposition filter. */
    @GetMapping("/dispositions")
    public ResponseEntity<List<CallDispositionCatalogDTO>> dispositions(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<CallDispositionCatalogDTO> out = callDispositionService.listForInstitute(instituteId).stream()
                .map(CallDispositionCatalogDTO::from).toList();
        return ResponseEntity.ok(out);
    }

    /** Quick after-call disposition; syncs the lead's pipeline status when the outcome maps to one. */
    @PostMapping("/{callLogId}/disposition")
    public ResponseEntity<Map<String, Object>> disposition(
            @PathVariable String callLogId,
            @RequestParam("instituteId") String instituteId,
            @RequestBody CallDispositionRequestDTO req,
            @RequestAttribute("user") CustomUserDetails user) {
        if (req == null || req.getDispositionKey() == null || req.getDispositionKey().isBlank()) {
            throw new VacademyException("dispositionKey is required");
        }
        instituteAccessValidator.validateUserAccess(user, instituteId);
        AppliedDisposition applied = callDispositionService.applyDisposition(
                callLogId, instituteId, req.getDispositionKey().trim(), req.getNotes(),
                req.getCallbackAtEpochMillis(), user.getUserId());

        Map<String, Object> body = new HashMap<>();
        body.put("call_log_id", applied.call().getId());
        body.put("disposition_key", applied.outcome().getDispositionKey());
        body.put("disposition_label", applied.outcome().getLabel());
        body.put("disposition_color", applied.outcome().getColor());
        body.put("category", applied.outcome().getCategory());
        body.put("dispositioned_at", epoch(applied.call().getDispositionedAt()));
        body.put("callback_at", epoch(applied.call().getCallbackAt()));
        body.put("lead_status_synced", applied.leadStatusSynced());
        return ResponseEntity.ok(body);
    }

    private static Long epoch(Timestamp t) {
        return t == null ? null : t.getTime();
    }

    /** KPI strip: headline counts (same filters as the list, minus chips) + chip badges. */
    @PostMapping("/metrics")
    public ResponseEntity<CallMetricsDTO> metrics(
            @RequestBody CallSearchFilterDTO filter,
            @RequestAttribute("user") CustomUserDetails user) {
        if (filter == null || filter.getInstituteId() == null || filter.getInstituteId().isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        instituteAccessValidator.validateUserAccess(user, filter.getInstituteId());
        return ResponseEntity.ok(callSearchService.metrics(filter, user.getUserId()));
    }

    /** Export the filtered call list as CSV or XLSX (synchronous, capped at {@value #EXPORT_CAP} rows). */
    @PostMapping("/export")
    public void export(
            @RequestBody CallSearchFilterDTO filter,
            @RequestParam(value = "format", defaultValue = "csv") String format,
            @RequestAttribute("user") CustomUserDetails user,
            HttpServletResponse response) {
        if (filter == null || filter.getInstituteId() == null || filter.getInstituteId().isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        instituteAccessValidator.validateUserAccess(user, filter.getInstituteId());
        boolean unmask = hasAuthority(user, VIEW_CALL_NUMBERS);
        List<CallRowDTO> rows = callSearchService.exportRows(filter, user.getUserId(), unmask, EXPORT_CAP);
        boolean xlsx = "xlsx".equalsIgnoreCase(format) || "excel".equalsIgnoreCase(format);
        try {
            if (xlsx) {
                response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                response.setHeader("Content-Disposition", "attachment; filename=\"calls.xlsx\"");
                callExportService.writeXlsx(rows, response.getOutputStream());
            } else {
                response.setContentType("text/csv; charset=UTF-8");
                response.setHeader("Content-Disposition", "attachment; filename=\"calls.csv\"");
                OutputStreamWriter writer = new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8);
                callExportService.writeCsv(rows, writer);
            }
        } catch (java.io.IOException e) {
            throw new UncheckedIOException("Failed to write call export", e);
        }
    }

    private static boolean hasAuthority(CustomUserDetails user, String authority) {
        if (user == null || user.getAuthorities() == null) return false;
        for (GrantedAuthority a : user.getAuthorities()) {
            if (a != null && authority.equalsIgnoreCase(a.getAuthority())) return true;
        }
        return false;
    }
}
