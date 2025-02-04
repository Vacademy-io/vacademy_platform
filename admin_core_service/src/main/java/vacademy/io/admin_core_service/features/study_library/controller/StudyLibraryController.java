package vacademy.io.admin_core_service.features.study_library.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course.dto.CourseDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.dto.ModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.dto.SessionDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.service.StudyLibraryService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/study-library")
public class StudyLibraryController {

    @Autowired
    private StudyLibraryService studyLibraryService;

    @GetMapping("/init")
    public ResponseEntity<List<CourseDTOWithDetails>> initStudyLibrary(String instituteId) {
        return ResponseEntity.ok(studyLibraryService.getStudyLibraryInitDetails(instituteId));
    }

    @GetMapping("/modules-with-chapters")
    public ResponseEntity<List<ModuleDTOWithDetails>> modulesWithChapters(@RequestParam("subjectId") String subjectId,@RequestParam("sessionId")String sessionId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(studyLibraryService.getModulesDetailsWithChapters(subjectId,sessionId, user));
    }
}
