package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;

import java.util.HashMap;
import java.util.Map;

/**
 * Internal API controller for workflow operations.
 * Called by other services (e.g., notification_service) via HMAC
 * authentication.
 */
@RestController
@RequestMapping("/admin-core-service/internal/workflow")
@RequiredArgsConstructor
@Slf4j
public class InternalWorkflowController {

    private final WorkflowEngineService workflowEngineService;
    private final WorkflowTriggerService workflowTriggerService;

    /**
     * Run a workflow with the provided context.
     * Called by notification_service when a WORKFLOW action is triggered.
     * 
     * @param wfId    Workflow ID to execute
     * @param context Context map containing phoneNumber, instituteId, userId, etc.
     * @return Workflow execution result
     */
    @PostMapping("/run")
    public ResponseEntity<Map<String, Object>> runWorkflow(
            @RequestParam String wfId,
            @RequestBody(required = false) Map<String, Object> context) {

        log.info("Internal workflow run request: wfId={}, contextKeys={}",
                wfId,
                context != null ? context.keySet() : "null");

        try {
            Map<String, Object> seedContext = context != null ? context : Map.of();
            Map<String, Object> result = workflowEngineService.run(wfId, seedContext);

            log.info("Workflow executed successfully: wfId={}", wfId);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("Workflow execution failed: wfId={}, error={}", wfId, e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "error",
                    "message", e.getMessage()));
        }
    }

    /**
     * Trigger a workflow event from an external service (e.g., assessment_service).
     * Accepts event details and delegates to WorkflowTriggerService.
     *
     * @param request Map containing eventName, eventId, instituteId, and optional contextData
     * @return Workflow trigger result
     */
    @SuppressWarnings("unchecked")
    @PostMapping("/trigger")
    public ResponseEntity<Map<String, Object>> triggerWorkflowEvent(
            @RequestBody Map<String, Object> request) {

        String eventName = (String) request.get("eventName");
        String eventId = (String) request.get("eventId");
        String instituteId = (String) request.get("instituteId");
        Map<String, Object> contextData = (Map<String, Object>) request.getOrDefault("contextData", new HashMap<>());

        log.info("Internal workflow trigger request: eventName={}, eventId={}, instituteId={}",
                eventName, eventId, instituteId);

        Map<String, Object> result = workflowTriggerService.handleTriggerEvents(
                eventName, eventId, instituteId, contextData);
        return ResponseEntity.ok(result);
    }

    /**
     * Health check endpoint for internal workflow API.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "healthy",
                "service", "internal-workflow-api"));
    }
}
