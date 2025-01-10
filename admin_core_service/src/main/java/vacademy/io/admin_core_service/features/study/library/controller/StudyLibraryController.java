package vacademy.io.admin_core_service.features.study.library.controller;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.study.library.dto.SessionDTOWithDetails;
import vacademy.io.admin_core_service.features.study.library.service.StudyLibraryService;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/study-library")
public class StudyLibraryController {

    @Autowired
    private StudyLibraryService studyLibraryService;

    @GetMapping("/init")
    public ResponseEntity<List<SessionDTOWithDetails>> initUserLibrary(String instituteId) {
        return ResponseEntity.ok(studyLibraryService.getStudyLibraryInitDetails(instituteId));
    }
}
