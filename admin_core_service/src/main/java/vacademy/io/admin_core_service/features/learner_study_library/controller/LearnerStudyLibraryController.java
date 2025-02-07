package vacademy.io.admin_core_service.features.learner_study_library.controller;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course.dto.CourseDTOWithDetails;
import vacademy.io.admin_core_service.features.learner_study_library.service.LearnerStudyLibraryService;
import vacademy.io.admin_core_service.features.slide.dto.SlideDetailProjection;
import vacademy.io.admin_core_service.features.study_library.dto.ModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.dto.SessionDTOWithDetails;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/learner-study-library")
public class LearnerStudyLibraryController {
    @Autowired
    private LearnerStudyLibraryService learnerStudyLibraryService;

    @GetMapping("/init-details")
    public ResponseEntity<SessionDTOWithDetails> getLearnerStudyLibraryInitDetails(
            @RequestParam String instituteId,
            @RequestParam String packageSessionId,
            @RequestAttribute("user")CustomUserDetails user) {
        return ResponseEntity.ok(learnerStudyLibraryService.getLearnerStudyLibraryInitDetails(instituteId, packageSessionId, user));
    }

    @GetMapping("/modules-with-chapters")
    public ResponseEntity<List<ModuleDTOWithDetails>> modulesWithChapters(@RequestParam("subjectId") String subjectId, @RequestParam("packageSessionId") String packageSessionId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerStudyLibraryService.getModulesDetailsWithChapters(subjectId,packageSessionId, user));
    }

    @GetMapping("/get-slides/{chapterId}")
    public ResponseEntity<List<SlideDetailProjection>> getSlidesByChapterId(@PathVariable String chapterId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerStudyLibraryService.getSlidesByChapterId(chapterId,user));
    }
}
