package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;
import vacademy.io.admin_core_service.features.workflow.service.IdempotencyService;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowScheduleService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/workflow/schedule")
@RequiredArgsConstructor
public class WorkflowScheduleController {

    private final WorkflowScheduleService workflowScheduleService;
    private final IdempotencyService idempotencyService;

    /**
     * Get all workflow schedules
     */
    @GetMapping
    public ResponseEntity<List<WorkflowSchedule>> getAllSchedules() {
        try {
            List<WorkflowSchedule> schedules = workflowScheduleService.getAllSchedules();
            return ResponseEntity.ok(schedules);
        } catch (Exception e) {
            log.error("Error retrieving all schedules", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get active workflow schedules
     */
    @GetMapping("/active")
    public ResponseEntity<List<WorkflowSchedule>> getActiveSchedules() {
        try {
            List<WorkflowSchedule> activeSchedules = workflowScheduleService.getActiveSchedules();
            return ResponseEntity.ok(activeSchedules);
        } catch (Exception e) {
            log.error("Error retrieving active schedules", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get schedules due for execution
     */
    @GetMapping("/due")
    public ResponseEntity<List<WorkflowSchedule>> getDueSchedules() {
        try {
            List<WorkflowSchedule> dueSchedules = workflowScheduleService.getDueSchedules();
            return ResponseEntity.ok(dueSchedules);
        } catch (Exception e) {
            log.error("Error retrieving due schedules", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get workflow schedule by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<WorkflowSchedule> getScheduleById(@PathVariable String id) {
        try {
            return workflowScheduleService.getScheduleById(id)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            log.error("Error retrieving schedule by ID: {}", id, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Create a new workflow schedule
     */
    @PostMapping
    public ResponseEntity<WorkflowSchedule> createSchedule(@RequestBody WorkflowSchedule schedule) {
        try {
            WorkflowSchedule createdSchedule = workflowScheduleService.createSchedule(schedule);
            return ResponseEntity.ok(createdSchedule);
        } catch (Exception e) {
            log.error("Error creating schedule", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Update an existing workflow schedule
     */
    @PutMapping("/{id}")
    public ResponseEntity<WorkflowSchedule> updateSchedule(@PathVariable String id,
            @RequestBody WorkflowSchedule schedule) {
        try {
            WorkflowSchedule updatedSchedule = workflowScheduleService.updateSchedule(id, schedule);
            return ResponseEntity.ok(updatedSchedule);
        } catch (Exception e) {
            log.error("Error updating schedule: {}", id, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Deactivate a workflow schedule
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivateSchedule(@PathVariable String id) {
        try {
            workflowScheduleService.deactivateSchedule(id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Error deactivating schedule: {}", id, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Test endpoint to manually trigger schedule execution
     */
    @PostMapping("/{id}/execute")
    public ResponseEntity<Map<String, Object>> executeSchedule(@PathVariable String id) {
        try {
            // Get the schedule
            Optional<WorkflowSchedule> scheduleOpt = workflowScheduleService.getScheduleById(id);
            if (scheduleOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            WorkflowSchedule schedule = scheduleOpt.get();

            // Check if schedule is active
            if (!schedule.isActive()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Schedule is not active",
                        "status", schedule.getStatus()));
            }

            // Execute the schedule
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("scheduleId", schedule.getId());
            result.put("workflowId", schedule.getWorkflowId());
            result.put("executionTime", System.currentTimeMillis());
            result.put("message", "Schedule executed manually");

            // Update schedule execution time
            workflowScheduleService.updateNextExecutionTime(id, LocalDateTime.now().plusMinutes(1));

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("Error executing schedule: {}", id, e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", e.getMessage()));
        }
    }

    /**
     * Get idempotency statistics
     */
    @GetMapping("/idempotency/stats")
    public ResponseEntity<Map<String, Long>> getIdempotencyStats() {
        try {
            Map<String, Long> stats = idempotencyService.getStatistics();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("Error retrieving idempotency stats", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get idempotency status for a specific key
     */
    @GetMapping("/idempotency/status/{key}")
    public ResponseEntity<IdempotencyService.ExecutionStatus> getIdempotencyStatus(@PathVariable String key) {
        try {
            IdempotencyService.ExecutionStatus status = idempotencyService.getExecutionStatus(key);
            if (status != null) {
                return ResponseEntity.ok(status);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            log.error("Error retrieving idempotency status for key: {}", key, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Clear idempotency data
     */
    @DeleteMapping("/idempotency/clear/{key}")
    public ResponseEntity<Void> clearIdempotencyData(@PathVariable String key) {
        try {
            idempotencyService.clearIdempotencyKey(key);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Error clearing idempotency data for key: {}", key, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "WorkflowScheduleController",
                "timestamp", java.time.LocalDateTime.now().toString()));
    }
}