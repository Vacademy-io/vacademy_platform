package vacademy.io.admin_core_service.features.audience.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.audience.dto.CounselorPerformanceDTO;
import vacademy.io.admin_core_service.features.audience.dto.LeadReportSummaryDTO;
import vacademy.io.admin_core_service.features.audience.service.LeadReportService;

/**
 * Read-only endpoints powering the Lead Reports page (summary KPIs + counsellor performance).
 * All endpoints are institute-scoped and date-bounded (defaults to last 30 days when from/to omitted).
 */
@RestController
@RequestMapping("/admin-core-service/v1/reports")
@RequiredArgsConstructor
public class LeadReportController {

    private final LeadReportService leadReportService;

    /** Lead summary: KPIs + status / source / tier breakdowns + daily trend. */
    @GetMapping("/leads/summary")
    public ResponseEntity<LeadReportSummaryDTO> getLeadSummary(
            @RequestParam String instituteId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate) {
        return ResponseEntity.ok(leadReportService.getLeadSummary(instituteId, fromDate, toDate));
    }

    /** Per-counsellor performance rows + weighted summary. */
    @GetMapping("/counselor-performance")
    public ResponseEntity<CounselorPerformanceDTO> getCounselorPerformance(
            @RequestParam String instituteId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate) {
        return ResponseEntity.ok(leadReportService.getCounselorPerformance(instituteId, fromDate, toDate));
    }
}
