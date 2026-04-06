package vacademy.io.notification_service.features.chatbot_flow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.chatbot_flow.dto.ChatbotFlowSessionDTO;
import vacademy.io.notification_service.features.chatbot_flow.dto.FlowAnalyticsDTO;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlow;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowNode;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowSession;
import vacademy.io.notification_service.features.chatbot_flow.repository.ChatbotFlowNodeRepository;
import vacademy.io.notification_service.features.chatbot_flow.repository.ChatbotFlowRepository;
import vacademy.io.notification_service.features.chatbot_flow.repository.ChatbotFlowSessionRepository;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class ChatbotFlowSessionService {

    private final ChatbotFlowSessionRepository sessionRepository;
    private final ChatbotFlowRepository flowRepository;
    private final ChatbotFlowNodeRepository nodeRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final ObjectMapper objectMapper;

    /**
     * List sessions for a flow, ordered by most recent activity.
     */
    public List<ChatbotFlowSessionDTO> listSessions(String flowId, String status, int page, int size) {
        List<ChatbotFlowSession> sessions;
        if (status != null && !status.isBlank()) {
            sessions = sessionRepository.findByFlowIdAndStatus(flowId, status.toUpperCase());
        } else {
            sessions = sessionRepository.findByFlowIdOrderByStartedAtDesc(flowId);
        }

        // Manual pagination (could use Spring Pageable if repo methods are updated)
        int start = page * size;
        if (start >= sessions.size()) return List.of();
        int end = Math.min(start + size, sessions.size());
        List<ChatbotFlowSession> pageSlice = sessions.subList(start, end);

        // Lookup flow name and node names
        String flowName = flowRepository.findById(flowId).map(ChatbotFlow::getName).orElse(flowId);
        Map<String, ChatbotFlowNode> nodeMap = nodeRepository.findByFlowId(flowId).stream()
                .collect(Collectors.toMap(ChatbotFlowNode::getId, n -> n));

        return pageSlice.stream().map(s -> toSessionDTO(s, flowName, nodeMap)).collect(Collectors.toList());
    }

    /**
     * Get a single session with its message history.
     */
    public ChatbotFlowSessionDTO getSessionDetail(String sessionId) {
        ChatbotFlowSession session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null) return null;

        String flowName = flowRepository.findById(session.getFlowId())
                .map(ChatbotFlow::getName).orElse(session.getFlowId());
        Map<String, ChatbotFlowNode> nodeMap = nodeRepository.findByFlowId(session.getFlowId()).stream()
                .collect(Collectors.toMap(ChatbotFlowNode::getId, n -> n));

        ChatbotFlowSessionDTO dto = toSessionDTO(session, flowName, nodeMap);

        // Fetch message history for this user on this channel
        List<NotificationLog> logs = notificationLogRepository
                .findByChannelIdAndNotificationTypeInOrderByNotificationDateAsc(
                        session.getUserPhone(),
                        List.of("WHATSAPP_MESSAGE_OUTGOING", "WHATSAPP_MESSAGE_INCOMING")
                );

        // Filter to messages within session timeframe
        List<ChatbotFlowSessionDTO.SessionMessage> messages = logs.stream()
                .filter(l -> {
                    if (session.getStartedAt() == null) return true;
                    java.time.LocalDateTime logTime = l.getNotificationDate();
                    java.time.LocalDateTime sessionStart = session.getStartedAt().toLocalDateTime();
                    return logTime != null && !logTime.isBefore(sessionStart);
                })
                .map(l -> ChatbotFlowSessionDTO.SessionMessage.builder()
                        .id(l.getId() != null ? l.getId().toString() : null)
                        .type(l.getNotificationType())
                        .body(l.getBody())
                        .source(l.getSource())
                        .timestamp(l.getNotificationDate() != null ? l.getNotificationDate().toString() : null)
                        .direction(l.getNotificationType().contains("OUTGOING") ? "OUTGOING" : "INCOMING")
                        .build())
                .collect(Collectors.toList());

        dto.setMessages(messages);
        return dto;
    }

    /**
     * Analytics for a single flow.
     */
    public FlowAnalyticsDTO getFlowAnalytics(String flowId) {
        ChatbotFlow flow = flowRepository.findById(flowId).orElse(null);
        if (flow == null) return null;

        List<ChatbotFlowSession> allSessions = sessionRepository.findByFlowIdOrderByStartedAtDesc(flowId);

        long active = allSessions.stream().filter(s -> "ACTIVE".equals(s.getStatus())).count();
        long completed = allSessions.stream().filter(s -> "COMPLETED".equals(s.getStatus())).count();
        long error = allSessions.stream().filter(s -> "ERROR".equals(s.getStatus())).count();
        long timedOut = allSessions.stream().filter(s -> "TIMED_OUT".equals(s.getStatus())).count();

        return FlowAnalyticsDTO.builder()
                .flowId(flowId)
                .flowName(flow.getName())
                .status(flow.getStatus())
                .totalSessions(allSessions.size())
                .activeSessions(active)
                .completedSessions(completed)
                .errorSessions(error)
                .timedOutSessions(timedOut)
                .build();
    }

    /**
     * Analytics for all flows of an institute.
     */
    public List<FlowAnalyticsDTO> getInstituteAnalytics(String instituteId) {
        List<ChatbotFlow> flows = flowRepository.findByInstituteIdOrderByUpdatedAtDesc(instituteId);
        return flows.stream().map(f -> getFlowAnalytics(f.getId())).filter(Objects::nonNull).collect(Collectors.toList());
    }

    private ChatbotFlowSessionDTO toSessionDTO(ChatbotFlowSession session, String flowName,
                                                 Map<String, ChatbotFlowNode> nodeMap) {
        ChatbotFlowNode currentNode = session.getCurrentNodeId() != null
                ? nodeMap.get(session.getCurrentNodeId()) : null;

        return ChatbotFlowSessionDTO.builder()
                .id(session.getId())
                .flowId(session.getFlowId())
                .flowName(flowName)
                .instituteId(session.getInstituteId())
                .userPhone(session.getUserPhone())
                .userId(session.getUserId())
                .currentNodeId(session.getCurrentNodeId())
                .currentNodeName(currentNode != null ? currentNode.getName() : null)
                .currentNodeType(currentNode != null ? currentNode.getNodeType() : null)
                .status(session.getStatus())
                .context(parseJson(session.getContext()))
                .startedAt(session.getStartedAt() != null ? session.getStartedAt().toString() : null)
                .lastActivityAt(session.getLastActivityAt() != null ? session.getLastActivityAt().toString() : null)
                .completedAt(session.getCompletedAt() != null ? session.getCompletedAt().toString() : null)
                .build();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return null;
        }
    }
}
