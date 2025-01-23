package vacademy.io.admin_core_service.features.study.library.controller;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.CustomAutowireConfigurer;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.study.library.dto.ModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.study.library.dto.SessionDTOWithDetails;
import vacademy.io.admin_core_service.features.study.library.service.StudyLibraryService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/study-library")
public class StudyLibraryController {

    @Autowired
    private StudyLibraryService studyLibraryService;

    @GetMapping("/init")
    public ResponseEntity<List<SessionDTOWithDetails>> initStudyLibrary(String instituteId) {
        return ResponseEntity.ok(studyLibraryService.getStudyLibraryInitDetails(instituteId));
    }

    @GetMapping("/modules-with-chapters/{subjectId}")
    public ResponseEntity<List<ModuleDTOWithDetails>> modulesWithChapters(@PathVariable("subjectId") String subjectId,@RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(studyLibraryService.getModulesDetailsWithChapters(subjectId, user));
    }
}
