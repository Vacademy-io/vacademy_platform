package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowBuilderDTO;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowValidationService {

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

        return errors;
    }
}
