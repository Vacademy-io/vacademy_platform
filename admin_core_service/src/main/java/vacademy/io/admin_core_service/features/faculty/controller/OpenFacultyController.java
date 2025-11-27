package vacademy.io.admin_core_service.features.faculty.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.faculty.dto.AddFacultyToSubjectAndBatchDTO;
import vacademy.io.admin_core_service.features.faculty.dto.FacultyAllResponse;
import vacademy.io.admin_core_service.features.faculty.dto.FacultyBatchSubjectDTO;
import vacademy.io.admin_core_service.features.faculty.dto.FacultyRequestFilter;
import vacademy.io.admin_core_service.features.faculty.service.FacultyService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;


@RestController
@RequestMapping("/admin-core-service/open/institute/v1/faculty")
@RequiredArgsConstructor
public class OpenFacultyController {

    private final FacultyService facultyService;


    @GetMapping("/by-institute/only-creator/{instituteId}")
    public ResponseEntity<List<UserDTO>> getFacultyByInstitute(@PathVariable String instituteId) {
        return ResponseEntity.ok(facultyService.findFacultyByFilters(instituteId));
    }
}
