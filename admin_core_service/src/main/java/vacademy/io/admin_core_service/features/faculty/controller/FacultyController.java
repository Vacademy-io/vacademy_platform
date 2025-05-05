package vacademy.io.admin_core_service.features.faculty.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.faculty.dto.AddFacultyToSubjectAndBatchDTO;
import vacademy.io.admin_core_service.features.faculty.service.FacultyService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/api/faculty")
@RequiredArgsConstructor
public class FacultyController {

    private final FacultyService facultyService;

    @PostMapping("/assign-subjects-and-batches")
    public ResponseEntity<String> assignFacultyToSubjectsAndBatches(
            @RequestBody AddFacultyToSubjectAndBatchDTO request,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        String result = facultyService.addFacultyToSubjectsAndBatches(request, instituteId, userDetails);
        return ResponseEntity.ok(result);
    }
}






