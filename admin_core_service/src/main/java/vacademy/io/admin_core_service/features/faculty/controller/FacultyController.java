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

import static vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_SIZE;

@RestController
@RequestMapping("/admin-core-service/institute/v1/faculty")
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

    @PostMapping("/faculty/get-all")
    public ResponseEntity<FacultyAllResponse> getAllTeachers(@RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam String instituteId,
            @RequestBody FacultyRequestFilter filter,
            @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
            @RequestParam(value = "pageSize", defaultValue = DEFAULT_PAGE_SIZE, required = false) int pageSize) {
        return facultyService.getAllFaculty(userDetails, instituteId, filter, pageNo, pageSize);
    }

    @PutMapping("/update-assign-subjects-and-batches")
    public ResponseEntity<String> updateAssignFacultyToSubjectsAndBatches(@RequestBody FacultyBatchSubjectDTO request,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(facultyService.updateFacultyAssignmentsToSubjects(request, userDetails));
    }

    @GetMapping("/batch-subject-assignments")
    public ResponseEntity<FacultyBatchSubjectDTO> getFacultyBatchSubjectAssignments(
            @RequestParam String userId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(facultyService.getAllFacultyBatchSubject(userId, userDetails));
    }

    @GetMapping("/by-institute/only-creator/{instituteId}")
    public ResponseEntity<List<UserDTO>> getFacultyByInstitute(@PathVariable String instituteId) {
        return ResponseEntity.ok(facultyService.findFacultyByFilters(instituteId));
    }

    @GetMapping("/user-access-details")
    public ResponseEntity<vacademy.io.admin_core_service.features.faculty.dto.UserAccessDetailsDTO> getUserAccessDetails(
            @RequestParam String userId,
            @RequestParam String instituteId) {
        return ResponseEntity.ok(facultyService.getUserAccessDetails(userId, instituteId));
    }

}
