package vacademy.io.notification_service.features.chatbot_flow.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.notification_service.features.chatbot_flow.dto.ChatbotFlowDTO;
import vacademy.io.notification_service.features.chatbot_flow.dto.ChatbotFlowEdgeDTO;
import vacademy.io.notification_service.features.chatbot_flow.dto.ChatbotFlowNodeDTO;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlow;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowEdge;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowNode;
import vacademy.io.notification_service.features.chatbot_flow.enums.ChatbotFlowStatus;
import vacademy.io.notification_service.features.chatbot_flow.enums.ChatbotNodeType;
import vacademy.io.notification_service.features.chatbot_flow.repository.ChatbotFlowEdgeRepository;
import vacademy.io.notification_service.features.chatbot_flow.repository.ChatbotFlowNodeRepository;
import vacademy.io.notification_service.features.chatbot_flow.repository.ChatbotFlowRepository;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class ChatbotFlowCrudService {

    private final ChatbotFlowRepository flowRepository;
    private final ChatbotFlowNodeRepository nodeRepository;
    private final ChatbotFlowEdgeRepository edgeRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ChatbotFlowDTO createFlow(ChatbotFlowDTO dto) {
        ChatbotFlow flow = ChatbotFlow.builder()
                .instituteId(dto.getInstituteId())
                .name(dto.getName())
                .description(dto.getDescription())
                .channelType(dto.getChannelType())
                .status(ChatbotFlowStatus.DRAFT.name())
                .version(1)
                .triggerConfig(toJson(dto.getTriggerConfig()))
                .settings(toJson(dto.getSettings()))
                .createdBy(dto.getCreatedBy())
                .build();
        flow = flowRepository.save(flow);

        saveNodesAndEdges(flow.getId(), dto.getNodes(), dto.getEdges());

        return getFlow(flow.getId());
    }

    public ChatbotFlowDTO getFlow(String flowId) {
        ChatbotFlow flow = flowRepository.findById(flowId)
                .orElseThrow(() -> new VacademyException("Flow not found: " + flowId));
        List<ChatbotFlowNode> nodes = nodeRepository.findByFlowId(flowId);
        List<ChatbotFlowEdge> edges = edgeRepository.findByFlowId(flowId);
        return toDTO(flow, nodes, edges);
    }

    public List<ChatbotFlowDTO> listFlows(String instituteId, String status) {
        List<ChatbotFlow> flows;
        if (status != null && !status.isBlank()) {
            flows = flowRepository.findByInstituteIdAndStatusOrderByUpdatedAtDesc(instituteId, status.toUpperCase());
        } else {
            flows = flowRepository.findByInstituteIdOrderByUpdatedAtDesc(instituteId);
        }
        return flows.stream()
                .map(f -> toDTO(f, null, null))
                .collect(Collectors.toList());
    }

    @Transactional
    public ChatbotFlowDTO updateFlow(String flowId, ChatbotFlowDTO dto) {
        ChatbotFlow flow = flowRepository.findById(flowId)
                .orElseThrow(() -> new VacademyException("Flow not found: " + flowId));

        // Prevent editing ACTIVE flows — deactivate first to avoid breaking running sessions
        if (ChatbotFlowStatus.ACTIVE.name().equals(flow.getStatus())) {
            throw new VacademyException("Cannot update an ACTIVE flow. Deactivate it first.");
        }

        flow.setName(dto.getName());
        flow.setDescription(dto.getDescription());
        flow.setChannelType(dto.getChannelType());
        flow.setTriggerConfig(toJson(dto.getTriggerConfig()));
        flow.setSettings(toJson(dto.getSettings()));
        flow.setVersion(flow.getVersion() + 1);
        flowRepository.save(flow);

        // Full replace: delete all existing nodes/edges, re-insert
        edgeRepository.deleteByFlowId(flowId);
        nodeRepository.deleteByFlowId(flowId);
        saveNodesAndEdges(flowId, dto.getNodes(), dto.getEdges());

        return getFlow(flowId);
    }

    @Transactional
    public void deleteFlow(String flowId) {
        ChatbotFlow flow = flowRepository.findById(flowId)
                .orElseThrow(() -> new VacademyException("Flow not found: " + flowId));
        flow.setStatus(ChatbotFlowStatus.ARCHIVED.name());
        flowRepository.save(flow);
    }

    @Transactional
    public ChatbotFlowDTO activateFlow(String flowId) {
        ChatbotFlow flow = flowRepository.findById(flowId)
                .orElseThrow(() -> new VacademyException("Flow not found: " + flowId));

        // Validate the graph
        List<ChatbotFlowNode> nodes = nodeRepository.findByFlowId(flowId);
        List<ChatbotFlowEdge> edges = edgeRepository.findByFlowId(flowId);
        validateFlowGraph(nodes, edges);

        flow.setStatus(ChatbotFlowStatus.ACTIVE.name());
        flowRepository.save(flow);

        return toDTO(flow, nodes, edges);
    }

    @Transactional
    public ChatbotFlowDTO deactivateFlow(String flowId) {
        ChatbotFlow flow = flowRepository.findById(flowId)
                .orElseThrow(() -> new VacademyException("Flow not found: " + flowId));
        flow.setStatus(ChatbotFlowStatus.INACTIVE.name());
        flowRepository.save(flow);
        return getFlow(flowId);
    }

    @Transactional
    public ChatbotFlowDTO duplicateFlow(String flowId) {
        ChatbotFlowDTO original = getFlow(flowId);
        original.setId(null);
        original.setName(original.getName() + " (Copy)");
        original.setStatus(ChatbotFlowStatus.DRAFT.name());

        // Generate new IDs for nodes and update edge references
        Map<String, String> oldToNewNodeId = new HashMap<>();
        if (original.getNodes() != null) {
            for (ChatbotFlowNodeDTO node : original.getNodes()) {
                String oldId = node.getId();
                String newId = UUID.randomUUID().toString();
                oldToNewNodeId.put(oldId, newId);
                node.setId(newId);
            }
        }
        if (original.getEdges() != null) {
            for (ChatbotFlowEdgeDTO edge : original.getEdges()) {
                edge.setId(UUID.randomUUID().toString());
                edge.setSourceNodeId(oldToNewNodeId.getOrDefault(edge.getSourceNodeId(), edge.getSourceNodeId()));
                edge.setTargetNodeId(oldToNewNodeId.getOrDefault(edge.getTargetNodeId(), edge.getTargetNodeId()));
            }
        }

        return createFlow(original);
    }

    // ==================== Validation ====================

    private void validateFlowGraph(List<ChatbotFlowNode> nodes, List<ChatbotFlowEdge> edges) {
        if (nodes == null || nodes.isEmpty()) {
            throw new VacademyException("Flow must have at least one node");
        }

        // Must have exactly one TRIGGER node
        long triggerCount = nodes.stream()
                .filter(n -> ChatbotNodeType.TRIGGER.name().equals(n.getNodeType()))
                .count();
        if (triggerCount == 0) {
            throw new VacademyException("Flow must have exactly one TRIGGER node");
        }
        if (triggerCount > 1) {
            throw new VacademyException("Flow cannot have more than one TRIGGER node");
        }

        // Check for orphan nodes (no incoming or outgoing edges, except TRIGGER which has no incoming)
        Set<String> nodeIds = nodes.stream().map(ChatbotFlowNode::getId).collect(Collectors.toSet());
        Set<String> nodesWithIncoming = edges != null
                ? edges.stream().map(ChatbotFlowEdge::getTargetNodeId).collect(Collectors.toSet())
                : Set.of();
        Set<String> nodesWithOutgoing = edges != null
                ? edges.stream().map(ChatbotFlowEdge::getSourceNodeId).collect(Collectors.toSet())
                : Set.of();

        String triggerNodeId = nodes.stream()
                .filter(n -> ChatbotNodeType.TRIGGER.name().equals(n.getNodeType()))
                .findFirst().map(ChatbotFlowNode::getId).orElse(null);

        for (ChatbotFlowNode node : nodes) {
            String id = node.getId();
            boolean isTrigger = id.equals(triggerNodeId);

            // Trigger: must have at least one outgoing edge
            if (isTrigger) {
                if (!nodesWithOutgoing.contains(id)) {
                    throw new VacademyException("TRIGGER node must have at least one outgoing connection");
                }
                continue;
            }

            // Non-trigger: must be reachable (have at least one incoming edge)
            if (!nodesWithIncoming.contains(id)) {
                throw new VacademyException("Unreachable node: " + node.getName() + " (" + node.getNodeType() + ") has no incoming connections");
            }
        }

        // Validate all edge references point to existing nodes
        if (edges != null) {
            for (ChatbotFlowEdge edge : edges) {
                if (!nodeIds.contains(edge.getSourceNodeId())) {
                    throw new VacademyException("Edge references non-existent source node: " + edge.getSourceNodeId());
                }
                if (!nodeIds.contains(edge.getTargetNodeId())) {
                    throw new VacademyException("Edge references non-existent target node: " + edge.getTargetNodeId());
                }
            }
        }
    }

    // ==================== Persistence Helpers ====================

    private void saveNodesAndEdges(String flowId, List<ChatbotFlowNodeDTO> nodeDtos, List<ChatbotFlowEdgeDTO> edgeDtos) {
        // Save nodes first (edges reference them)
        Map<String, String> clientIdToDbId = new HashMap<>();

        if (nodeDtos != null) {
            for (ChatbotFlowNodeDTO dto : nodeDtos) {
                String clientId = dto.getId();
                ChatbotFlowNode node = ChatbotFlowNode.builder()
                        .flowId(flowId)
                        .nodeType(dto.getNodeType())
                        .name(dto.getName())
                        .config(toJson(dto.getConfig()))
                        .positionX(dto.getPositionX())
                        .positionY(dto.getPositionY())
                        .build();
                node = nodeRepository.save(node);
                if (clientId != null) {
                    clientIdToDbId.put(clientId, node.getId());
                }
            }
        }

        // Save edges, mapping client node IDs to DB-generated IDs
        if (edgeDtos != null) {
            for (ChatbotFlowEdgeDTO dto : edgeDtos) {
                String sourceId = clientIdToDbId.getOrDefault(dto.getSourceNodeId(), dto.getSourceNodeId());
                String targetId = clientIdToDbId.getOrDefault(dto.getTargetNodeId(), dto.getTargetNodeId());

                ChatbotFlowEdge edge = ChatbotFlowEdge.builder()
                        .flowId(flowId)
                        .sourceNodeId(sourceId)
                        .targetNodeId(targetId)
                        .conditionLabel(dto.getConditionLabel())
                        .conditionConfig(toJson(dto.getConditionConfig()))
                        .sortOrder(dto.getSortOrder())
                        .build();
                edgeRepository.save(edge);
            }
        }
    }

    // ==================== Mapping Helpers ====================

    private ChatbotFlowDTO toDTO(ChatbotFlow flow, List<ChatbotFlowNode> nodes, List<ChatbotFlowEdge> edges) {
        ChatbotFlowDTO dto = ChatbotFlowDTO.builder()
                .id(flow.getId())
                .instituteId(flow.getInstituteId())
                .name(flow.getName())
                .description(flow.getDescription())
                .channelType(flow.getChannelType())
                .status(flow.getStatus())
                .version(flow.getVersion())
                .triggerConfig(fromJson(flow.getTriggerConfig()))
                .settings(fromJson(flow.getSettings()))
                .createdBy(flow.getCreatedBy())
                .createdAt(flow.getCreatedAt() != null ? flow.getCreatedAt().toString() : null)
                .updatedAt(flow.getUpdatedAt() != null ? flow.getUpdatedAt().toString() : null)
                .build();

        if (nodes != null) {
            dto.setNodes(nodes.stream().map(this::toNodeDTO).collect(Collectors.toList()));
        }
        if (edges != null) {
            dto.setEdges(edges.stream().map(this::toEdgeDTO).collect(Collectors.toList()));
        }
        return dto;
    }

    private ChatbotFlowNodeDTO toNodeDTO(ChatbotFlowNode node) {
        return ChatbotFlowNodeDTO.builder()
                .id(node.getId())
                .nodeType(node.getNodeType())
                .name(node.getName())
                .config(fromJson(node.getConfig()))
                .positionX(node.getPositionX())
                .positionY(node.getPositionY())
                .build();
    }

    private ChatbotFlowEdgeDTO toEdgeDTO(ChatbotFlowEdge edge) {
        return ChatbotFlowEdgeDTO.builder()
                .id(edge.getId())
                .sourceNodeId(edge.getSourceNodeId())
                .targetNodeId(edge.getTargetNodeId())
                .conditionLabel(edge.getConditionLabel())
                .conditionConfig(fromJson(edge.getConditionConfig()))
                .sortOrder(edge.getSortOrder())
                .build();
    }

    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize to JSON: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse JSON: {}", e.getMessage());
            return null;
        }
    }
}
