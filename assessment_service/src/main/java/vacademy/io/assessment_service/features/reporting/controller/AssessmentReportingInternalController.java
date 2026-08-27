package vacademy.io.assessment_service.features.reporting.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.assessment_service.features.reporting.service.AssessmentReportingService;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;

/**
 * Institute-level assessment aggregate for admin_core's scheduled reports.
 *
 * <ul>
 *   <li>Read-only. No writes.
 *   <li>ONE call per generated report document — deliberately, because the existing
 *       per-learner endpoint would mean thousands of calls inside a scheduled job.
 *   <li>Adds no table, entity or migration.
 * </ul>
 *
 * Dates are taken as plain ISO dates and interpreted as UTC instants, matching how
 * admin_core already resolves report windows: it computes institute-local day
 * boundaries and converts them before calling out, so the boundary decision stays
 * in one place rather than being re-derived here from a timezone this service does
 * not know.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/assessment-service/internal/reporting/v1")
public class AssessmentReportingInternalController {

    private final AssessmentReportingService reportingService;

    @GetMapping("/assessment-summary")
    public ResponseEntity<Map<String, Object>> assessmentSummary(
            @RequestParam String instituteId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        Instant start = from.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = to.atStartOfDay(ZoneOffset.UTC).toInstant();
        log.info("internal/reporting/assessment-summary: institute={} from={} to={}",
                instituteId, from, to);
        return ResponseEntity.ok(reportingService.summary(instituteId, start, end));
    }
}
