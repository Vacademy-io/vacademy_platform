package vacademy.io.admin_core_service.features.learner_study_library.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSlidesDetailDTO;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSubjectProjection;
import vacademy.io.admin_core_service.features.learner_study_library.service.LearnerStudyLibraryService;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDetailProjection;
import vacademy.io.admin_core_service.features.study_library.dto.ChapterDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.service.StudyLibraryService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.dto.SubjectDTO;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/learner-study-library")
public class LearnerStudyLibraryController {
    @Autowired
    private LearnerStudyLibraryService learnerStudyLibraryService;

    @Autowired
    private StudyLibraryService studyLibraryService;

    @GetMapping("/init-details")
    public ResponseEntity<List<LearnerSubjectProjection>> getLearnerStudyLibraryInitDetails(
            @RequestParam String packageSessionId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerStudyLibraryService.getSubjectsByPackageSessionId(packageSessionId, user));
    }

    @GetMapping("/modules-with-chapters")
    public ResponseEntity<List<LearnerModuleDTOWithDetails>> modulesWithChapters(@RequestParam("subjectId") String subjectId, @RequestParam("packageSessionId") String packageSessionId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerStudyLibraryService.getModulesDetailsWithChapters(subjectId, packageSessionId, user));
    }

    @GetMapping("/get-slides/{chapterId}")
    public ResponseEntity<List<SlideDetailProjection>> getSlidesByChapterId(@PathVariable String chapterId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerStudyLibraryService.getSlidesByChapterId(chapterId, user));
    }

    @GetMapping("/slides")
    public ResponseEntity<List<LearnerSlidesDetailDTO>> getLearnerSlidesByChapterId(@RequestParam String chapterId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerStudyLibraryService.getLearnerSlides(chapterId, user));
    }

    @GetMapping("/chapters-with-slides")
    public ResponseEntity<List<ChapterDTOWithDetails>>getChaptersWithSlides(@RequestParam("moduleId") String subjectId, @RequestParam("packageSessionId") String packageSessionId) {
        return ResponseEntity.ok(studyLibraryService.getChaptersWithSlides(subjectId, packageSessionId, null));
    }
}
