package vacademy.io.admin_core_service.features.workflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowBuilderDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.entity.Workflow;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowNodeMapping;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.repository.NodeTemplateRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowNodeMappingRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowScheduleRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowTriggerRepository;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowBuilderService {

    private final WorkflowRepository workflowRepository;
    private final NodeTemplateRepository nodeTemplateRepository;
    private final WorkflowNodeMappingRepository mappingRepository;
    private final WorkflowScheduleRepository scheduleRepository;
    private final WorkflowTriggerRepository triggerRepository;
    private final WorkflowValidationService validationService;
    private final ObjectMapper objectMapper;

    @Transactional
    public WorkflowBuilderDTO createWorkflow(WorkflowBuilderDTO dto, String userId) {
        // Validate
        List<WorkflowValidationService.ValidationError> errors = validationService.validate(dto);
        List<WorkflowValidationService.ValidationError> criticalErrors = errors.stream()
                .filter(e -> "ERROR".equals(e.getSeverity()))
                .collect(Collectors.toList());
        if (!criticalErrors.isEmpty()) {
            throw new IllegalArgumentException("Validation errors: " +
                    criticalErrors.stream().map(WorkflowValidationService.ValidationError::getMessage)
                            .collect(Collectors.joining(", ")));
        }

        // Create workflow
        Workflow workflow = Workflow.builder()
                .name(dto.getName())
                .description(dto.getDescription())
                .status(dto.getStatus() != null ? dto.getStatus() : "DRAFT")
                .workflowType(dto.getWorkflowType() != null ? dto.getWorkflowType() : "SCHEDULED")
                .createdByUserId(userId)
                .instituteId(dto.getInstituteId())
                .build();
        workflow = workflowRepository.save(workflow);
        String workflowId = workflow.getId();

        // Map client node IDs to DB node IDs
        Map<String, String> clientToDbNodeId = new HashMap<>();

        // Create node templates and mappings
        int order = 0;
        for (WorkflowBuilderDTO.NodeDTO nodeDto : dto.getNodes()) {
            String configJson;
            try {
                // Build config including routing from edges
                Map<String, Object> config = new HashMap<>();
                if (nodeDto.getConfig() != null) {
                    if (nodeDto.getConfig() instanceof Map) {
                        config.putAll((Map<String, Object>) nodeDto.getConfig());
                    } else {
                        config = objectMapper.readValue(
                                objectMapper.writeValueAsString(nodeDto.getConfig()),
                                Map.class);
                    }
                }
                configJson = objectMapper.writeValueAsString(config);
            } catch (Exception e) {
                configJson = "{}";
                log.error("Failed to serialize node config for node: {}", nodeDto.getName(), e);
            }

            NodeTemplate template = NodeTemplate.builder()
                    .instituteId(dto.getInstituteId())
                    .nodeName(nodeDto.getName())
                    .nodeType(nodeDto.getNodeType())
                    .status("ACTIVE")
                    .version(1)
                    .configJson(configJson)
                    .build();
            template = nodeTemplateRepository.save(template);

            clientToDbNodeId.put(nodeDto.getId(), template.getId());

            WorkflowNodeMapping mapping = WorkflowNodeMapping.builder()
                    .workflowId(workflowId)
                    .nodeTemplateId(template.getId())
                    .nodeOrder(order++)
                    .isStartNode(Boolean.TRUE.equals(nodeDto.getIsStartNode()))
                    .isEndNode(Boolean.TRUE.equals(nodeDto.getIsEndNode()))
                    .build();
            mappingRepository.save(mapping);
        }

        // Now update routing in each node config based on edges
        if (dto.getEdges() != null && !dto.getEdges().isEmpty()) {
            // Group edges by source
            Map<String, List<WorkflowBuilderDTO.EdgeDTO>> edgesBySource = dto.getEdges().stream()
                    .collect(Collectors.groupingBy(WorkflowBuilderDTO.EdgeDTO::getSourceNodeId));

            for (Map.Entry<String, List<WorkflowBuilderDTO.EdgeDTO>> entry : edgesBySource.entrySet()) {
                String clientSourceId = entry.getKey();
                String dbSourceId = clientToDbNodeId.get(clientSourceId);
                if (dbSourceId == null) continue;

                NodeTemplate sourceTemplate = nodeTemplateRepository.findById(dbSourceId).orElse(null);
                if (sourceTemplate == null) continue;

                try {
                    Map<String, Object> config = objectMapper.readValue(sourceTemplate.getConfigJson(), Map.class);
                    List<Map<String, Object>> routing = new ArrayList<>();

                    for (WorkflowBuilderDTO.EdgeDTO edge : entry.getValue()) {
                        String dbTargetId = clientToDbNodeId.get(edge.getTargetNodeId());
                        if (dbTargetId == null) continue;

                        Map<String, Object> route = new HashMap<>();
                        if (edge.getCondition() != null && !edge.getCondition().isBlank()) {
                            route.put("type", "conditional");
                            route.put("condition", edge.getCondition());
                            route.put("trueNodeId", dbTargetId);
                        } else {
                            route.put("type", "goto");
                            route.put("targetNodeId", dbTargetId);
                        }
                        if (edge.getLabel() != null) {
                            route.put("label", edge.getLabel());
                        }
                        routing.add(route);
                    }

                    config.put("routing", routing);
                    sourceTemplate.setConfigJson(objectMapper.writeValueAsString(config));
                    nodeTemplateRepository.save(sourceTemplate);
                } catch (Exception e) {
                    log.error("Failed to update routing for node: {}", dbSourceId, e);
                }
            }

            // Mark nodes with no outgoing edges as end nodes with "end" routing
            Set<String> sourcesWithEdges = dto.getEdges().stream()
                    .map(WorkflowBuilderDTO.EdgeDTO::getSourceNodeId)
                    .collect(Collectors.toSet());

            for (WorkflowBuilderDTO.NodeDTO nodeDto : dto.getNodes()) {
                if (!sourcesWithEdges.contains(nodeDto.getId())) {
                    String dbNodeId = clientToDbNodeId.get(nodeDto.getId());
                    if (dbNodeId == null) continue;

                    NodeTemplate tmpl = nodeTemplateRepository.findById(dbNodeId).orElse(null);
                    if (tmpl == null) continue;

                    try {
                        Map<String, Object> config = objectMapper.readValue(tmpl.getConfigJson(), Map.class);
                        List<Map<String, Object>> routing = new ArrayList<>();
                        routing.add(Map.of("type", "end"));
                        config.put("routing", routing);
                        tmpl.setConfigJson(objectMapper.writeValueAsString(config));
                        nodeTemplateRepository.save(tmpl);
                    } catch (Exception e) {
                        log.error("Failed to set end routing for node: {}", dbNodeId, e);
                    }
                }
            }
        }

        // Create schedule if applicable
        if ("SCHEDULED".equalsIgnoreCase(dto.getWorkflowType()) && dto.getSchedule() != null) {
            WorkflowBuilderDTO.ScheduleDTO sch = dto.getSchedule();
            WorkflowSchedule schedule = new WorkflowSchedule();
            schedule.setId(UUID.randomUUID().toString());
            schedule.setWorkflowId(workflowId);
            schedule.setScheduleType(sch.getScheduleType());
            schedule.setCronExpression(sch.getCronExpression());
            schedule.setIntervalMinutes(sch.getIntervalMinutes());
            schedule.setTimezone(sch.getTimezone() != null ? sch.getTimezone() : "UTC");
            schedule.setStartDate(sch.getStartDate() != null ? Instant.parse(sch.getStartDate()) : Instant.now());
            if (sch.getEndDate() != null) {
                schedule.setEndDate(Instant.parse(sch.getEndDate()));
            }
            schedule.setStatus("ACTIVE");
            scheduleRepository.save(schedule);
        }

        // Create trigger if applicable
        if ("EVENT_DRIVEN".equalsIgnoreCase(dto.getWorkflowType()) && dto.getTrigger() != null) {
            WorkflowBuilderDTO.TriggerDTO trig = dto.getTrigger();
            WorkflowTrigger trigger = WorkflowTrigger.builder()
                    .triggerEventName(trig.getTriggerEventName())
                    .instituteId(dto.getInstituteId())
                    .description(trig.getDescription())
                    .status("ACTIVE")
                    .eventId(trig.getEventId())
                    .build();
            // Set workflow relationship - need to fetch the managed entity
            Workflow managedWorkflow = workflowRepository.findById(workflowId).orElseThrow();
            trigger.setWorkflow(managedWorkflow);
            triggerRepository.save(trigger);
        }

        // Build response
        dto.setId(workflowId);
        // Remap node IDs to DB IDs
        for (WorkflowBuilderDTO.NodeDTO node : dto.getNodes()) {
            String dbId = clientToDbNodeId.get(node.getId());
            if (dbId != null) {
                node.setId(dbId);
            }
        }

        return dto;
    }

    @Transactional
    public void deleteWorkflow(String workflowId) {
        Workflow workflow = workflowRepository.findById(workflowId)
                .orElseThrow(() -> new RuntimeException("Workflow not found: " + workflowId));
        workflow.setStatus("INACTIVE");
        workflowRepository.save(workflow);

        // Deactivate schedules
        scheduleRepository.findByWorkflowIdAndStatus(workflowId, "ACTIVE")
                .forEach(s -> {
                    s.setStatus("INACTIVE");
                    scheduleRepository.save(s);
                });

        // Deactivate triggers
        triggerRepository.findByWorkflowId(workflowId)
                .forEach(t -> {
                    t.setStatus("INACTIVE");
                    triggerRepository.save(t);
                });

        log.info("Soft-deleted workflow: {}", workflowId);
    }

    @Transactional(readOnly = true)
    public WorkflowBuilderDTO getWorkflowForEditing(String workflowId) {
        Workflow workflow = workflowRepository.findById(workflowId)
                .orElseThrow(() -> new RuntimeException("Workflow not found: " + workflowId));

        List<WorkflowNodeMapping> mappings = mappingRepository.findByWorkflowIdOrderByNodeOrderAsc(workflowId);

        List<WorkflowBuilderDTO.NodeDTO> nodes = new ArrayList<>();
        Map<String, String> dbIdToClientId = new HashMap<>();

        for (WorkflowNodeMapping mapping : mappings) {
            NodeTemplate template = nodeTemplateRepository.findById(mapping.getNodeTemplateId()).orElse(null);
            if (template == null) continue;

            Object configObj = null;
            try {
                configObj = objectMapper.readValue(template.getConfigJson(), Map.class);
            } catch (Exception e) {
                configObj = template.getConfigJson();
            }

            WorkflowBuilderDTO.NodeDTO nodeDto = WorkflowBuilderDTO.NodeDTO.builder()
                    .id(template.getId())
                    .name(template.getNodeName())
                    .nodeType(template.getNodeType())
                    .config(configObj)
                    .isStartNode(mapping.getIsStartNode())
                    .isEndNode(mapping.getIsEndNode())
                    .build();
            nodes.add(nodeDto);
            dbIdToClientId.put(template.getId(), template.getId());
        }

        // Extract edges from routing configs
        List<WorkflowBuilderDTO.EdgeDTO> edges = new ArrayList<>();
        for (WorkflowBuilderDTO.NodeDTO node : nodes) {
            if (node.getConfig() instanceof Map) {
                Map<String, Object> config = (Map<String, Object>) node.getConfig();
                Object routingObj = config.get("routing");
                if (routingObj instanceof List) {
                    List<Map<String, Object>> routing = (List<Map<String, Object>>) routingObj;
                    for (Map<String, Object> route : routing) {
                        String type = String.valueOf(route.getOrDefault("type", ""));
                        if ("goto".equalsIgnoreCase(type)) {
                            String targetId = String.valueOf(route.get("targetNodeId"));
                            edges.add(WorkflowBuilderDTO.EdgeDTO.builder()
                                    .id(UUID.randomUUID().toString())
                                    .sourceNodeId(node.getId())
                                    .targetNodeId(targetId)
                                    .label((String) route.get("label"))
                                    .build());
                        } else if ("conditional".equalsIgnoreCase(type)) {
                            String trueNodeId = String.valueOf(route.get("trueNodeId"));
                            String falseNodeId = route.get("falseNodeId") != null ? String.valueOf(route.get("falseNodeId")) : null;
                            edges.add(WorkflowBuilderDTO.EdgeDTO.builder()
                                    .id(UUID.randomUUID().toString())
                                    .sourceNodeId(node.getId())
                                    .targetNodeId(trueNodeId)
                                    .label("true")
                                    .condition((String) route.get("condition"))
                                    .build());
                            if (falseNodeId != null) {
                                edges.add(WorkflowBuilderDTO.EdgeDTO.builder()
                                        .id(UUID.randomUUID().toString())
                                        .sourceNodeId(node.getId())
                                        .targetNodeId(falseNodeId)
                                        .label("false")
                                        .build());
                            }
                        }
                    }
                }
                // Remove routing from config so it doesn't confuse the editor
                config.remove("routing");
            }
        }

        // Get schedule
        WorkflowBuilderDTO.ScheduleDTO scheduleDto = null;
        List<WorkflowSchedule> schedules = scheduleRepository.findByWorkflowIdAndStatus(workflowId, "ACTIVE");
        if (!schedules.isEmpty()) {
            WorkflowSchedule schedule = schedules.get(0);
            scheduleDto = WorkflowBuilderDTO.ScheduleDTO.builder()
                    .scheduleType(schedule.getScheduleType())
                    .cronExpression(schedule.getCronExpression())
                    .intervalMinutes(schedule.getIntervalMinutes())
                    .timezone(schedule.getTimezone())
                    .startDate(schedule.getStartDate() != null ? schedule.getStartDate().toString() : null)
                    .endDate(schedule.getEndDate() != null ? schedule.getEndDate().toString() : null)
                    .build();
        }

        // Get trigger
        WorkflowBuilderDTO.TriggerDTO triggerDto = null;
        List<WorkflowTrigger> triggers = triggerRepository.findByWorkflowId(workflowId);
        if (!triggers.isEmpty()) {
            WorkflowTrigger trigger = triggers.get(0);
            triggerDto = WorkflowBuilderDTO.TriggerDTO.builder()
                    .triggerEventName(trigger.getTriggerEventName())
                    .description(trigger.getDescription())
                    .eventId(trigger.getEventId())
                    .build();
        }

        return WorkflowBuilderDTO.builder()
                .id(workflow.getId())
                .name(workflow.getName())
                .description(workflow.getDescription())
                .status(workflow.getStatus())
                .workflowType(workflow.getWorkflowType())
                .instituteId(workflow.getInstituteId())
                .nodes(nodes)
                .edges(edges)
                .schedule(scheduleDto)
                .trigger(triggerDto)
                .build();
    }
}
