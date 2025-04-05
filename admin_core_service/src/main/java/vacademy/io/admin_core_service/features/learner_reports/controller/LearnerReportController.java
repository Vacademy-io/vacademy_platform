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
        if (userDetails.getUserId().equalsIgnoreCase("bb4ac8b0-8855-4a86-9e27-4ea62c99fd41")) {
            return ResponseEntity.ok(generateDummyVedProgress(filterDTO));
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

        if (userDetails.getUserId().equalsIgnoreCase("bb4ac8b0-8855-4a86-9e27-4ea62c99fd41")) {
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
            return ResponseEntity.ok(generateDummyVedSlideProgress(reportFilterDTO));
        }
        return ResponseEntity.ok(learnerReportService.getSlideProgressForLearner(reportFilterDTO, userDetails));
    }

    private LearnerProgressReportDTO generateDummyVedProgress(ReportFilterDTO filterDTO) {
        List<AvgDailyTimeSpentDTO> dummyTimeList = new ArrayList<>();
        LocalDate startDate = filterDTO.getStartDate().toLocalDate();
        LocalDate endDate = filterDTO.getEndDate().toLocalDate();

        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            double randomTime = randomDouble(30, 60);
            dummyTimeList.add(new AvgDailyTimeSpentDTO(date.toString(), randomTime));
        }

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

    private List<SlideProgressDateWiseDTO> generateDummyVedSlideProgress(ReportFilterDTO filterDTO) {
        List<SlideProgressDateWiseDTO> slideProgressList = new ArrayList<>();
        LocalDate startDate = filterDTO.getStartDate().toLocalDate();
        LocalDate endDate = filterDTO.getEndDate().toLocalDate();
        int count = 0;

        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            SlideProgressDTO slide = new SlideProgressDTO(
                    "slide" + count,
                    "Slide Title " + (count + 1),
                    "ch1",
                    "Essence of Slide " + (count + 1),
                    "m1",
                    "Module Name",
                    "ved001",
                    "Ved",
                    randomDouble(70, 100),
                    "00:0" + (5 + count % 5) + ":00"
            );
            slideProgressList.add(new SlideProgressDateWiseDTO(date.toString(), List.of(slide)));
            count++;
        }

        return slideProgressList;
    }
}
