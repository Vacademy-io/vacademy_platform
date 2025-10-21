package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowResponseDTO;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowService;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/v1/workflow")
@RequiredArgsConstructor
public class WorkflowController {

    private final WorkflowService workflowService;

    @GetMapping("/institute/{instituteId}")
    public ResponseEntity<List<WorkflowResponseDTO>> getActiveWorkflowsByInstituteId(
            @PathVariable String instituteId) {

        List<WorkflowResponseDTO> workflows = workflowService.getActiveWorkflowsByInstituteId(instituteId);
        return ResponseEntity.ok(workflows);
    }
}