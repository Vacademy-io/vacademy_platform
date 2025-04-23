package vacademy.io.admin_core_service.features.learner_reports.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_reports.dto.*;
import vacademy.io.admin_core_service.features.learner_reports.service.BatchReportService;
import vacademy.io.admin_core_service.features.learner_reports.service.LearnerReportService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@RestController
@RequestMapping("/admin-core-service/learner-management/learner-report")
public class LearnerReportController {

    @Autowired
    private LearnerReportService learnerReportService;

    @Autowired
    private BatchReportService batchReportService;

    @PostMapping
    public ResponseEntity<LearnerProgressReportDTO> getLearnerProgressReport(@RequestBody ReportFilterDTO filterDTO,
                                                                             @RequestAttribute("user") CustomUserDetails userDetails) {

        LearnerProgressReportDTO learnerProgressReportDTO = new LearnerProgressReportDTO();
        learnerProgressReportDTO.setLearnerProgressReport(learnerReportService.getLearnerProgressReport(filterDTO, userDetails));
        learnerProgressReportDTO.setBatchProgressReport(batchReportService.getBatchReport(filterDTO, userDetails));
        return ResponseEntity.ok(learnerProgressReportDTO);
    }

    @GetMapping("/subject-wise-progress")
    public ResponseEntity<List<LearnerSubjectWiseProgressReportDTO>> getSubjectWiseProgress(
            @RequestParam String packageSessionId,
            @RequestParam String userId,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        return ResponseEntity.ok(learnerReportService.getSubjectProgressReport(packageSessionId, userId, userDetails));
    }

    @GetMapping("/chapter-wise-progress")
    public ResponseEntity<List<LearnerChapterSlideProgressDTO>> getChapterWiseProgress(
            @RequestParam String userId,
            @RequestParam String packageSessionId,
            @RequestParam String moduleId,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        return ResponseEntity.ok(learnerReportService.getChapterSlideProgress(moduleId, userId,packageSessionId, userDetails));
    }

    @PostMapping("/slide-wise-progress")
    public ResponseEntity<List<SlideProgressDateWiseDTO>> getSlideWiseProgress(
            @RequestBody ReportFilterDTO reportFilterDTO,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(
                learnerReportService.getSlideProgressForLearner(reportFilterDTO,userDetails)
        );
    }
}
