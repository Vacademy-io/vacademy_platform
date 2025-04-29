package vacademy.io.admin_core_service.features.learner_reports.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_reports.dto.*;
import vacademy.io.admin_core_service.features.learner_reports.service.BatchReportService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/learner-management/batch-report")
public class BatchReportController {

    private final BatchReportService batchReportService;

    @Autowired
    public BatchReportController(BatchReportService batchReportService) {
        this.batchReportService = batchReportService;
    }

    @PostMapping
    public ResponseEntity<ProgressReportDTO> getBatchReportDetails(
            @RequestBody ReportFilterDTO reportFilterDTO,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(batchReportService.getBatchReport(reportFilterDTO, userDetails));
    }

    @PostMapping("/leaderboard")
    public ResponseEntity<Page<LearnerActivityDataProjection>> getBatchActivityDataWithRanks(
            @RequestBody ReportFilterDTO reportFilterDTO,
            @RequestParam(value = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) Integer pageNo,
            @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) Integer pageSize,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(
                batchReportService.getBatchActivityData(reportFilterDTO, pageNo, pageSize, userDetails)
        );
    }

    @GetMapping("/subject-wise-progress")
    public ResponseEntity<List<SubjectProgressDTO>> getSubjectWiseProgress(
            @RequestParam String packageSessionId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(
                batchReportService.getSubjectProgressReport(packageSessionId, userDetails)
        );
    }

    @GetMapping("/chapter-wise-progress")
    public ResponseEntity<List<ChapterSlideProgressDTO>> getChapterWiseProgress(
            @RequestParam String packageSessionId,
            @RequestParam String moduleId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(
                batchReportService.getChapterSlideProgress(moduleId, packageSessionId, userDetails)
        );
    }
}