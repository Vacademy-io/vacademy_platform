package vacademy.io.admin_core_service.features.instructor_copilot.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.instructor_copilot.dto.CreateInstructorCopilotLogRequest;
import vacademy.io.admin_core_service.features.instructor_copilot.dto.InstructorCopilotLogDTO;
import vacademy.io.admin_core_service.features.instructor_copilot.dto.UpdateInstructorCopilotLogRequest;
import vacademy.io.admin_core_service.features.instructor_copilot.service.InstructorCopilotService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/admin-core-service/instructor-copilot/v1")
@RequiredArgsConstructor
public class InstructorCopilotController {

    private final InstructorCopilotService service;

    @PostMapping("/create")
    public ResponseEntity<InstructorCopilotLogDTO> createLog(
            @RequestBody CreateInstructorCopilotLogRequest request,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(service.createLog(request, instituteId, user.getUserId()));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<InstructorCopilotLogDTO> updateLog(
            @PathVariable String id,
            @RequestBody UpdateInstructorCopilotLogRequest request) {
        return ResponseEntity.ok(service.updateLog(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLog(@PathVariable String id) {
        service.deleteLog(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/list")
    public ResponseEntity<List<InstructorCopilotLogDTO>> getLogs(
            @RequestParam String instituteId,
            @RequestParam String status,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) Date startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) Date endDate) {
        return ResponseEntity.ok(service.getLogs(instituteId, status, startDate, endDate));
    }
}
