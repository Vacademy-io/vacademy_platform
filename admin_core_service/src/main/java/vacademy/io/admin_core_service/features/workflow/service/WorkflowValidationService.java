package vacademy.io.admin_core_service.features.workflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.dto.IdempotencySettings;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowBuilderDTO;
import vacademy.io.admin_core_service.features.workflow.service.idempotency.IdempotencyStrategyFactory;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowValidationService {

    private final ObjectMapper objectMapper;
    private final IdempotencyStrategyFactory idempotencyStrategyFactory;

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class ValidationError {
        private String nodeId;
        private String field;
        private String message;
        private String severity; // ERROR, WARNING
    }

    public List<ValidationError> validate(WorkflowBuilderDTO dto) {
        List<ValidationError> errors = new ArrayList<>();

        if (dto.getName() == null || dto.getName().isBlank()) {
            errors.add(new ValidationError(null, "name", "Workflow name is required", "ERROR"));
        }

        if (dto.getNodes() == null || dto.getNodes().isEmpty()) {
            errors.add(new ValidationError(null, "nodes", "Workflow must have at least one node", "ERROR"));
            return errors; // Can't validate further without nodes
        }

        // Check for exactly one trigger/start node
        List<WorkflowBuilderDTO.NodeDTO> triggerNodes = dto.getNodes().stream()
                .filter(n -> "TRIGGER".equalsIgnoreCase(n.getNodeType()) || Boolean.TRUE.equals(n.getIsStartNode()))
                .collect(Collectors.toList());

        if (triggerNodes.isEmpty()) {
            errors.add(new ValidationError(null, "nodes", "Workflow must have at least one trigger/start node", "ERROR"));
        } else if (triggerNodes.size() > 1) {
            errors.add(new ValidationError(null, "nodes", "Workflow should have only one trigger/start node", "WARNING"));
        }

        // Check that all nodes have required fields
        Set<String> nodeIds = new HashSet<>();
        for (WorkflowBuilderDTO.NodeDTO node : dto.getNodes()) {
            if (node.getId() == null || node.getId().isBlank()) {
                errors.add(new ValidationError(null, "node.id", "All nodes must have an ID", "ERROR"));
            } else {
                nodeIds.add(node.getId());
            }

            if (node.getNodeType() == null || node.getNodeType().isBlank()) {
                errors.add(new ValidationError(node.getId(), "node_type", "Node type is required", "ERROR"));
            }

            if (node.getName() == null || node.getName().isBlank()) {
                errors.add(new ValidationError(node.getId(), "name", "Node name is required", "ERROR"));
            }

            if ("DELAY".equalsIgnoreCase(node.getNodeType())) {
                validateDelayConfig(node, errors);
            }
        }

        // Check edges reference existing nodes
        if (dto.getEdges() != null) {
            for (WorkflowBuilderDTO.EdgeDTO edge : dto.getEdges()) {
                if (!nodeIds.contains(edge.getSourceNodeId())) {
                    errors.add(new ValidationError(edge.getSourceNodeId(), "source_node_id",
                            "Edge references non-existent source node: " + edge.getSourceNodeId(), "ERROR"));
                }
                if (!nodeIds.contains(edge.getTargetNodeId())) {
                    errors.add(new ValidationError(edge.getTargetNodeId(), "target_node_id",
                            "Edge references non-existent target node: " + edge.getTargetNodeId(), "ERROR"));
                }
            }
        }

        // Check for orphan nodes (no incoming or outgoing edges, except trigger)
        if (dto.getEdges() != null && dto.getNodes().size() > 1) {
            Set<String> connectedNodes = new HashSet<>();
            for (WorkflowBuilderDTO.EdgeDTO edge : dto.getEdges()) {
                connectedNodes.add(edge.getSourceNodeId());
                connectedNodes.add(edge.getTargetNodeId());
            }
            for (WorkflowBuilderDTO.NodeDTO node : dto.getNodes()) {
                if (!connectedNodes.contains(node.getId()) && !"TRIGGER".equalsIgnoreCase(node.getNodeType())) {
                    // Triggers can be orphans if they're the only node
                    errors.add(new ValidationError(node.getId(), "connections",
                            "Node '" + node.getName() + "' has no connections", "WARNING"));
                }
            }
        }

        // Validate schedule/trigger based on workflow type
        if ("SCHEDULED".equalsIgnoreCase(dto.getWorkflowType())) {
            if (dto.getSchedule() == null) {
                errors.add(new ValidationError(null, "schedule", "Scheduled workflow must have a schedule configuration", "ERROR"));
            } else if ("CRON".equalsIgnoreCase(dto.getSchedule().getScheduleType()) &&
                    (dto.getSchedule().getCronExpression() == null || dto.getSchedule().getCronExpression().isBlank())) {
                errors.add(new ValidationError(null, "cron_expression", "Cron expression is required for CRON schedules", "ERROR"));
            }
        } else if ("EVENT_DRIVEN".equalsIgnoreCase(dto.getWorkflowType())) {
            if (dto.getTrigger() == null || dto.getTrigger().getTriggerEventName() == null) {
                errors.add(new ValidationError(null, "trigger", "Event-driven workflow must have a trigger event", "ERROR"));
            }
        }

        if (dto.getTrigger() != null && dto.getTrigger().getIdempotencyGenerationSetting() != null) {
            validateTriggerIdempotency(dto.getTrigger().getIdempotencyGenerationSetting(), errors);
        }

        return errors;
    }

    /**
     * Validate caller-supplied trigger idempotency settings (JSON object or string). The builder
     * falls back to a safe default when these are invalid, so surface the problem here where the
     * admin (or the AI drafter's repair loop) can actually fix it.
     */
    private void validateTriggerIdempotency(Object provided, List<ValidationError> errors) {
        try {
            String json = provided instanceof String s ? s : objectMapper.writeValueAsString(provided);
            if (json.isBlank() || "null".equals(json)) return;
            IdempotencySettings settings = objectMapper.readValue(json, IdempotencySettings.class);
            idempotencyStrategyFactory.validateSettings(settings);
        } catch (Exception e) {
            errors.add(new ValidationError(null, "trigger.idempotency_generation_setting",
                    "Invalid idempotency settings: " + e.getMessage(), "ERROR"));
        }
    }

    /**
     * DELAY has two shapes: fixed {@code delay.{value,unit}} and
     * {@code delay.{until:NEXT_DAY_OF_WEEK,dayOfWeek,time,timezone}}. The engine silently runs a
     * legacy flat {@code delayValue}/{@code delayUnit} config as a 0-delay, and a bad weekday /
     * time / timezone would only fail at runtime — surface both at validation time (this also
     * feeds the AI drafter's repair loop).
     */
    private void validateDelayConfig(WorkflowBuilderDTO.NodeDTO node, List<ValidationError> errors) {
        if (!(node.getConfig() instanceof Map<?, ?> config)) {
            return;
        }
        Object delayObj = config.get("delay");
        if (delayObj == null) {
            if (config.containsKey("delayValue") || config.containsKey("delayUnit")) {
                errors.add(new ValidationError(node.getId(), "config.delay",
                        "DELAY config must be nested under 'delay' ({value,unit} or {until:NEXT_DAY_OF_WEEK,...}); flat delayValue/delayUnit executes as a 0-delay", "ERROR"));
            }
            return;
        }
        if (!(delayObj instanceof Map<?, ?> delay)) {
            errors.add(new ValidationError(node.getId(), "config.delay", "'delay' must be an object", "ERROR"));
            return;
        }
        Object until = delay.get("until");
        if (until == null) {
            return; // fixed value/unit shape — value 0 already behaves as no-op, nothing fatal to check
        }
        if (!"NEXT_DAY_OF_WEEK".equalsIgnoreCase(String.valueOf(until))) {
            errors.add(new ValidationError(node.getId(), "config.delay.until",
                    "Unsupported delay 'until' mode: " + until + " (supported: NEXT_DAY_OF_WEEK)", "ERROR"));
            return;
        }
        Object dayOfWeek = delay.get("dayOfWeek");
        if (dayOfWeek != null) {
            try {
                java.time.DayOfWeek.valueOf(String.valueOf(dayOfWeek).toUpperCase());
            } catch (IllegalArgumentException e) {
                errors.add(new ValidationError(node.getId(), "config.delay.dayOfWeek",
                        "Invalid dayOfWeek: " + dayOfWeek + " (use MONDAY..SUNDAY)", "ERROR"));
            }
        }
        Object time = delay.get("time");
        if (time != null) {
            try {
                java.time.LocalTime.parse(String.valueOf(time));
            } catch (Exception e) {
                errors.add(new ValidationError(node.getId(), "config.delay.time",
                        "Invalid time: " + time + " (use HH:mm, e.g. 09:00)", "ERROR"));
            }
        }
        Object timezone = delay.get("timezone");
        if (timezone != null) {
            try {
                java.time.ZoneId.of(String.valueOf(timezone));
            } catch (Exception e) {
                errors.add(new ValidationError(node.getId(), "config.delay.timezone",
                        "Invalid timezone: " + timezone + " (use an IANA id, e.g. Asia/Kolkata)", "ERROR"));
            }
        }
    }
}
