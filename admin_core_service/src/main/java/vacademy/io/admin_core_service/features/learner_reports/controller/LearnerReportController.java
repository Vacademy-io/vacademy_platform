package vacademy.io.admin_core_service.features.learner_reports.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_reports.dto.*;
import vacademy.io.admin_core_service.features.learner_reports.service.BatchReportService;
import vacademy.io.admin_core_service.features.learner_reports.service.LearnerReportService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
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
        if (userDetails.getUserId().equalsIgnoreCase("bb4ac8b0-8855-4a86-9e27-4ea62c99fd41")){
            return ResponseEntity.ok(generateDummyVedProgress());
        }
        LearnerProgressReportDTO learnerProgressReportDTO = new LearnerProgressReportDTO();
        learnerProgressReportDTO.setLearnerProgressReport(learnerReportService.getLearnerProgressReport(filterDTO, userDetails));
        learnerProgressReportDTO.setBatchProgressReport(batchReportService.getBatchReport(filterDTO, userDetails));
        return ResponseEntity.ok(learnerProgressReportDTO);
    }

    @GetMapping("/subject-wise-progress")
    public ResponseEntity<List<SubjectProgressDTO>> getSubjectWiseProgress(
            @RequestParam String packageSessionId,
            @RequestParam String userId,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        if (userDetails.getUserId().equalsIgnoreCase("bb4ac8b0-8855-4a86-9e27-4ea62c99fd41")){
            return ResponseEntity.ok(generateDummySubjectProgress());
        }
        return ResponseEntity.ok(learnerReportService.getSubjectProgressReport(packageSessionId, userId, userDetails));
    }

    @GetMapping("/chapter-wise-progress")
    public ResponseEntity<List<ChapterSlideProgressDTO>> getChapterWiseProgress(
            @RequestParam String userId,
            @RequestParam String moduleId,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        if (userDetails.getUserId().equalsIgnoreCase("bb4ac8b0-8855-4a86-9e27-4ea62c99fd41")) {
            return ResponseEntity.ok(generateDummyUpnishadChapterProgress());
        }
        return ResponseEntity.ok(learnerReportService.getChapterSlideProgress(moduleId, userId, userDetails));
    }

    @PostMapping("/slide-wise-progress")
    public ResponseEntity<List<SlideProgressDateWiseDTO>> getSlideWiseProgress(
            @RequestBody ReportFilterDTO reportFilterDTO,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        if (userDetails.getUserId().equalsIgnoreCase("bb4ac8b0-8855-4a86-9e27-4ea62c99fd41")) {
            return ResponseEntity.ok(generateDummyVedSlideProgress());
        }
        return ResponseEntity.ok(learnerReportService.getSlideProgressForLearner(reportFilterDTO, userDetails));
    }

    private LearnerProgressReportDTO generateDummyVedProgress() {
        List<AvgDailyTimeSpentDTO> dummyTimeList = List.of(
                new AvgDailyTimeSpentDTO("2025-03-30", 45.0),
                new AvgDailyTimeSpentDTO("2025-03-31", 50.0),
                new AvgDailyTimeSpentDTO("2025-04-01", 35.0)
        );
        ProgressReportDTO dummyProgress = new ProgressReportDTO(
                78.5,
                43.3,
                80.2,
                dummyTimeList
        );
        LearnerProgressReportDTO dto = new LearnerProgressReportDTO();
        dto.setLearnerProgressReport(dummyProgress);
        dto.setBatchProgressReport(dummyProgress);
        return dto;
    }

    private List<SubjectProgressDTO> generateDummySubjectProgress() {
        SubjectProgressDTO ved = new SubjectProgressDTO();
        ved.setSubjectId(UUID.randomUUID().toString());
        ved.setSubjectName("Ved");
        ved.setModules(Arrays.asList(
                createModule("Rigveda"),
                createModule("Samveda")
        ));

        SubjectProgressDTO upnishad = new SubjectProgressDTO();
        upnishad.setSubjectId(UUID.randomUUID().toString());
        upnishad.setSubjectName("Upnishad");
        upnishad.setModules(Arrays.asList(
                createModule("Isha Upnishad"),
                createModule("Kena Upnishad"),
                createModule("Katha Upnishad")
        ));

        return Arrays.asList(ved, upnishad);
    }

    private SubjectProgressDTO.ModuleProgressDTO createModule(String name) {
        SubjectProgressDTO.ModuleProgressDTO module = new SubjectProgressDTO.ModuleProgressDTO();
        module.setModuleId(UUID.randomUUID().toString());
        module.setModuleName(name);
        module.setCompletionPercentage(randomDouble(40, 100));
        module.setAvgTimeSpentMinutes(randomDouble(60, 150));
        return module;
    }

    private double randomDouble(double min, double max) {
        return Math.round(ThreadLocalRandom.current().nextDouble(min, max) * 10.0) / 10.0;
    }

    private List<ChapterSlideProgressDTO> generateDummyUpnishadChapterProgress() {
        ChapterSlideProgressDTO chapter = new ChapterSlideProgressDTO();
        chapter.setChapterId("ch1");
        chapter.setChapterName("Introduction to Kena Upnishad");

        ChapterSlideProgressDTO.SlideProgressDTO slide1 = new ChapterSlideProgressDTO.SlideProgressDTO();
        slide1.setSlideId("slide1");
        slide1.setSlideTitle("Brahman and Atman");
        slide1.setSlideSourceType("VIDEO");
        slide1.setAvgTimeSpent(12.5);
        slide1.setAvgConcentrationScore(85.0);

        ChapterSlideProgressDTO.SlideProgressDTO slide2 = new ChapterSlideProgressDTO.SlideProgressDTO();
        slide2.setSlideId("slide2");
        slide2.setSlideTitle("Dialogue with Gods");
        slide2.setSlideSourceType("PDF");
        slide2.setAvgTimeSpent(15.0);
        slide2.setAvgConcentrationScore(75.0);

        chapter.setSlides(List.of(slide1, slide2));
        return List.of(chapter);
    }

    private List<SlideProgressDateWiseDTO> generateDummyVedSlideProgress() {
        SlideProgressDTO slide1 = new SlideProgressDTO(
                "slide1",
                "Rigveda Hymns",
                "ch1",
                "Essence of Rigveda",
                "m1",
                "Rigveda",
                "ved001",
                "Ved",
                90.0,
                "00:12:34"
        );
        SlideProgressDTO slide2 = new SlideProgressDTO(
                "slide2",
                "Samveda Chants",
                "ch1",
                "Essence of Samveda",
                "m1",
                "Samveda",
                "ved001",
                "Ved",
                85.0,
                "00:10:20"
        );
        SlideProgressDateWiseDTO day1 = new SlideProgressDateWiseDTO("2025-04-01", List.of(slide1));
        SlideProgressDateWiseDTO day2 = new SlideProgressDateWiseDTO("2025-04-02", List.of(slide2));
        return List.of(day1, day2);
    }

}
