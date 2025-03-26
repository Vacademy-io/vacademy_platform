package vacademy.io.admin_core_service.features.learner_reports.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_reports.dto.BatchReportDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.BatchReportFilterDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.LearnerActivityDataProjection;
import vacademy.io.admin_core_service.features.learner_reports.service.BatchReportService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-management/batch-report")
public class BatchReportController {

    private final BatchReportService batchReportService;

    @Autowired
    public BatchReportController(BatchReportService batchReportService) {
        this.batchReportService = batchReportService;
    }

    @PostMapping
    public ResponseEntity<BatchReportDTO> getPercentageCourseCompleted(
            @RequestBody BatchReportFilterDTO batchReportFilterDTO,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(batchReportService.getBatchReport(batchReportFilterDTO, userDetails));
    }

    @PostMapping("/leaderboard")
    public ResponseEntity<Page<LearnerActivityDataProjection>> getBatchActivityDataWithRanks(
            @RequestBody BatchReportFilterDTO batchReportFilterDTO,
            @RequestParam(value = "pageNo", defaultValue = vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_NUMBER) Integer pageNo,
            @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) Integer pageSize,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(
                batchReportService.getBatchActivityData(batchReportFilterDTO, pageNo, pageSize, userDetails)
        );
    }
}