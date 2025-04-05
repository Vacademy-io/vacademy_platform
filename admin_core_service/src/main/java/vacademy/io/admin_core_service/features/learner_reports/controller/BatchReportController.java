package vacademy.io.admin_core_service.features.learner_reports.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_reports.dto.*;
import vacademy.io.admin_core_service.features.learner_reports.service.BatchReportService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

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
        if (userDetails.getUserId().equalsIgnoreCase("bb4ac8b0-8855-4a86-9e27-4ea62c99fd41")){
            return ResponseEntity.ok(generateSingleProgressReportWithMoreDays());
        }
        return ResponseEntity.ok(batchReportService.getBatchReport(reportFilterDTO, userDetails));
    }

    @PostMapping("/leaderboard")
    public ResponseEntity<Page<LearnerActivityDataProjection>> getBatchActivityDataWithRanks(
            @RequestBody ReportFilterDTO reportFilterDTO,
            @RequestParam(value = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) Integer pageNo,
            @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) Integer pageSize,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        if (userDetails.getUserId().equalsIgnoreCase("bb4ac8b0-8855-4a86-9e27-4ea62c99fd41")){
            return ResponseEntity.ok(generateDummyLeaderboardPage(pageNo,pageSize));
        }
        return ResponseEntity.ok(
                batchReportService.getBatchActivityData(reportFilterDTO, pageNo, pageSize, userDetails)
        );
    }

    @GetMapping("/subject-wise-progress")
    public ResponseEntity<List<SubjectProgressDTO>> getSubjectWiseProgress(
            @RequestParam String packageSessionId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        if (userDetails.getUserId().equalsIgnoreCase("bb4ac8b0-8855-4a86-9e27-4ea62c99fd41")){
            return ResponseEntity.ok(generateDummySubjectProgress());
        }
        return ResponseEntity.ok(
                batchReportService.getSubjectProgressReport(packageSessionId, userDetails)
        );
    }

    @GetMapping("/chapter-wise-progress")
    public ResponseEntity<List<ChapterSlideProgressDTO>> getChapterWiseProgress(
            @RequestParam String packageSessionId,
            @RequestParam String moduleId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        if (userDetails.getUserId().equalsIgnoreCase("bb4ac8b0-8855-4a86-9e27-4ea62c99fd41")){
            return ResponseEntity.ok(generateDummyChapterSlideProgress());
        }
        return ResponseEntity.ok(
                batchReportService.getChapterSlideProgress(moduleId,packageSessionId, userDetails)
        );
    }

    public static ProgressReportDTO generateSingleProgressReportWithMoreDays() {
        List<AvgDailyTimeSpentDTO> dailyTimeSpent = Arrays.asList(
                new AvgDailyTimeSpentDTO("2025-03-25", 50.0),
                new AvgDailyTimeSpentDTO("2025-03-26", 55.0),
                new AvgDailyTimeSpentDTO("2025-03-27", 60.0),
                new AvgDailyTimeSpentDTO("2025-03-28", 65.0),
                new AvgDailyTimeSpentDTO("2025-03-29", 70.0),
                new AvgDailyTimeSpentDTO("2025-03-30", 75.0),
                new AvgDailyTimeSpentDTO("2025-03-31", 80.0)
        );

        return new ProgressReportDTO(
                88.0,
                110.0,
                92.5,
                dailyTimeSpent
        );
    }

    public static Page<LearnerActivityDataProjection> generateDummyLeaderboardPage(int pageNo, int pageSize) {
        List<String> names = Arrays.asList(
                "Punit Punde", "Shrishti Gupta", "Ratan Mishra", "Prathemesh Ingale", "Raj Shkeher",
                "Shiva Raj", "Piyush Raj", "Namita Dhawan", "Shubhahit Jain", "Riya Jain"
        );

        List<LearnerActivityDataProjection> allData = new ArrayList<>();

        for (int i = 0; i < names.size(); i++) {
            int rank = i + 1;
            String id = "user_" + rank;
            String name = names.get(i);
            String email = name.toLowerCase().replace(" ", ".") + "@example.com";
            double avgConcentration = 60 + (i * 3.5);
            double totalTime = 250 + (i * 20);
            double dailyAvgTime = Math.round(totalTime / 7.0 * 10.0) / 10.0;

            allData.add(new LearnerActivityDataProjection() {
                @Override public String getUserId() { return id; }
                @Override public String getFullName() { return name; }
                @Override public String getEmail() { return email; }
                @Override public Double getAvgConcentration() { return avgConcentration; }
                @Override public Double getTotalTime() { return totalTime; }
                @Override public Double getDailyAvgTime() { return dailyAvgTime; }
                @Override public Integer getRank() { return rank; }
            });
        }

        // Pagination
        int start = pageNo * pageSize;
        int end = Math.min(start + pageSize, allData.size());
        List<LearnerActivityDataProjection> pagedData = start >= allData.size() ? new ArrayList<>() : allData.subList(start, end);

        return new PageImpl<>(pagedData, PageRequest.of(pageNo, pageSize), allData.size());
    }

    public static List<SubjectProgressDTO> generateDummySubjectProgress() {
        // Subject 1: Ved
        SubjectProgressDTO ved = new SubjectProgressDTO();
        ved.setSubjectId(UUID.randomUUID().toString());
        ved.setSubjectName("Ved");
        ved.setModules(Arrays.asList(
                createModule("Rigveda"),
                createModule("Samveda")
        ));

        // Subject 2: Upnishad
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

    private static SubjectProgressDTO.ModuleProgressDTO createModule(String name) {
        SubjectProgressDTO.ModuleProgressDTO module = new SubjectProgressDTO.ModuleProgressDTO();
        module.setModuleId(UUID.randomUUID().toString());
        module.setModuleName(name);
        module.setCompletionPercentage(randomDouble(40, 100)); // random 40% to 100%
        module.setAvgTimeSpentMinutes(randomDouble(60, 150)); // random 60 to 150 mins
        return module;
    }

    private static double randomDouble(double min, double max) {
        return Math.round(ThreadLocalRandom.current().nextDouble(min, max) * 10.0) / 10.0;
    }

    public static List<ChapterSlideProgressDTO> generateDummyChapterSlideProgress() {
        ChapterSlideProgressDTO chapter1 = new ChapterSlideProgressDTO();
        chapter1.setChapterId(UUID.randomUUID().toString());
        chapter1.setChapterName("Introduction to Ved");

        chapter1.setSlides(Arrays.asList(
                createSlide("Slide 1: What is Ved?", "VIDEO"),
                createSlide("Slide 2: Types of Vedas", "PDF")
        ));

        ChapterSlideProgressDTO chapter2 = new ChapterSlideProgressDTO();
        chapter2.setChapterId(UUID.randomUUID().toString());
        chapter2.setChapterName("Essence of Upnishad");

        chapter2.setSlides(Arrays.asList(
                createSlide("Slide 1: Philosophical Foundations", "AUDIO"),
                createSlide("Slide 2: Key Concepts", "VIDEO"),
                createSlide("Slide 3: Application in Life", "PDF")
        ));

        return Arrays.asList(chapter1, chapter2);
    }

    private static ChapterSlideProgressDTO.SlideProgressDTO createSlide(String title, String type) {
        ChapterSlideProgressDTO.SlideProgressDTO slide = new ChapterSlideProgressDTO.SlideProgressDTO();
        slide.setSlideId(UUID.randomUUID().toString());
        slide.setSlideTitle(title);
        slide.setSlideSourceType(type);
        slide.setAvgTimeSpent(randomDouble(30, 120));
        slide.setAvgConcentrationScore(randomDouble(50, 100));
        return slide;
    }


}