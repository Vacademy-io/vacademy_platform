package vacademy.io.admin_core_service.features.subject.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.subject.service.SubjectService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.dto.SubjectDTO;

@RestController
@RequestMapping("/admin-core-service/subject/v1")
@RequiredArgsConstructor
public class SubjectController {
    private final SubjectService subjectService;

    @PostMapping("/add-subject")
    public ResponseEntity<SubjectDTO>addSubject(@RequestBody SubjectDTO subjectDTO, String packageSessionId,@RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(subjectService.addSubject(subjectDTO, packageSessionId,user));
    }

    @PutMapping("/update-subject")
    public ResponseEntity<SubjectDTO>updateSubject(@RequestBody SubjectDTO subjectDTO, String subjectId,@RequestAttribute("user")CustomUserDetails user) {
        return ResponseEntity.ok(subjectService.updateSubject(subjectDTO, subjectId,user));
    }

    @DeleteMapping("/delete-subject")
    public ResponseEntity<String>updateSubject(String subjectId,@RequestAttribute("user")CustomUserDetails user) {
        return ResponseEntity.ok(subjectService.deleteSubject(subjectId,user));
    }
}
