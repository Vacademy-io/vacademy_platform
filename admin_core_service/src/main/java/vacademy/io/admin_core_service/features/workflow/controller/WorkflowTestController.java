package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/workflow/test")
@RequiredArgsConstructor
public class WorkflowTestController {

    private final WorkflowEngineService workflowEngineService;

    @PostMapping("/execute")
    public ResponseEntity<Map<String, Object>> executeWorkflow(
            @RequestParam String workflowId,
            @RequestParam(required = false) String scheduleRunId,
            @RequestBody(required = false) Map<String, Object> seedContext) {

        try {
            String runId = scheduleRunId != null ? scheduleRunId : "test-run-" + System.currentTimeMillis();
            Map<String, Object> context = seedContext != null ? seedContext : new HashMap<>();

            log.info("Executing workflow: {} with runId: {}", workflowId, runId);

            Map<String, Object> result = workflowEngineService.run(workflowId, runId, context);

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("Error executing workflow: {}", workflowId, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            error.put("workflowId", workflowId);
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "Workflow Engine");
        return ResponseEntity.ok(response);
    }
}