package vacademy.io.admin_core_service.features.learner_study_library.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course.dto.CourseDTOWithDetails;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSlidesDetailDTO;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSubjectProjection;
import vacademy.io.admin_core_service.features.learner_study_library.service.LearnerOpenStudyLibraryService;
import vacademy.io.admin_core_service.features.slide.dto.SlideDetailProjection;
import vacademy.io.admin_core_service.features.study_library.dto.ChapterDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.service.StudyLibraryService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/open/v1/learner-study-library")
public class OpenLearnerStudyLibraryController {

    @Autowired
    private LearnerOpenStudyLibraryService learnerStudyLibraryService;

    @Autowired
    private StudyLibraryService studyLibraryService;

    @GetMapping("/init-details")
    public ResponseEntity<List<LearnerSubjectProjection>> getLearnerStudyLibraryInitDetails(
        @RequestParam String packageSessionId) {
        return ResponseEntity.ok(learnerStudyLibraryService.getSubjectsByPackageSessionId(packageSessionId));
    }

    @GetMapping("/modules-with-chapters")
    public ResponseEntity<List<LearnerModuleDTOWithDetails>> modulesWithChapters(@RequestParam("subjectId") String subjectId, @RequestParam("packageSessionId") String packageSessionId) {
        return ResponseEntity.ok(learnerStudyLibraryService.getModulesDetailsWithChapters(subjectId, packageSessionId));
    }


    @GetMapping("/slides")
    public ResponseEntity<List<LearnerSlidesDetailDTO>> getLearnerSlidesByChapterId(@RequestParam String chapterId) {
        return ResponseEntity.ok(learnerStudyLibraryService.getLearnerSlides(chapterId));
    }

    @GetMapping("/init")
    public ResponseEntity<List<CourseDTOWithDetails>> initStudyLibrary(String instituteId) {
        return ResponseEntity.ok(studyLibraryService.getStudyLibraryInitDetails(instituteId));
    }

    @GetMapping("/chapters-with-slides")
    public ResponseEntity<List<ChapterDTOWithDetails>>getChaptersWithSlides(@RequestParam("moduleId") String subjectId, @RequestParam("packageSessionId") String packageSessionId) {
        return ResponseEntity.ok(studyLibraryService.getChaptersWithSlides(subjectId, packageSessionId, null));
    }
}
