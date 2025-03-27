package vacademy.io.admin_core_service.features.learner_reports.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_reports.dto.ChapterSlideProgressDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.ProgressReportDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.ReportFilterDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.SubjectProgressDTO;
import vacademy.io.admin_core_service.features.learner_reports.service.LearnerReportService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/learner-management/learner-report")
public class LearnerReportController {

    @Autowired
    private LearnerReportService learnerReportService;

    @PostMapping
    public ResponseEntity<ProgressReportDTO> getLearnerProgressReport(@RequestBody ReportFilterDTO filterDTO
    , @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(learnerReportService.getLearnerProgressReport(filterDTO, userDetails));
    }

    @GetMapping("/subject-wise-progress")
    public ResponseEntity<List<SubjectProgressDTO>> getSubjectWiseProgress(
            @RequestParam String packageSessionId,
            @RequestParam String userId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(
                learnerReportService.getSubjectProgressReport(packageSessionId,userId, userDetails)
        );
    }

    @GetMapping("/chapter-wise-progress")
    public ResponseEntity<List<ChapterSlideProgressDTO>> getChapterWiseProgress(
            @RequestParam String userId,
            @RequestParam String moduleId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(
                learnerReportService.getChapterSlideProgress(moduleId,userId, userDetails)
        );
    }

}
