package vacademy.io.notification_service.features.chatbot_flow.engine;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.chatbot_flow.entity.*;
import vacademy.io.notification_service.features.chatbot_flow.enums.ChatbotFlowStatus;
import vacademy.io.notification_service.features.chatbot_flow.enums.ChatbotNodeType;
import vacademy.io.notification_service.features.chatbot_flow.enums.ChatbotSessionStatus;
import vacademy.io.notification_service.features.chatbot_flow.repository.*;

import java.sql.Timestamp;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class ChatbotFlowEngine {

    private static final int MAX_TRAVERSAL_DEPTH = 50;

    private final ChatbotFlowRepository flowRepository;
    private final ChatbotFlowNodeRepository nodeRepository;
    private final ChatbotFlowEdgeRepository edgeRepository;
    private final ChatbotFlowSessionRepository sessionRepository;
    private final ChatbotDelayTaskRepository delayTaskRepository;
    private final List<ChatbotNodeExecutor> executors;
    private final ObjectMapper objectMapper;

    /**
     * Main entry point called from CombotWebhookService.
     * Returns true if a chatbot flow handled this message (new graph-based system).
     * Returns false to fall back to legacy ChannelFlowConfig.
     */
    /**
     * NOT @Transactional — this method makes external HTTP calls (send WhatsApp, AI).
     * DB operations use fine-grained saves. Holding a transaction during network calls
     * would exhaust the connection pool under load.
     */
    public boolean handleIncomingMessage(String instituteId, String channelType,
                                          String userPhone, String userText,
                                          String businessChannelId,
                                          String messageType, String buttonId,
                                          String buttonPayload, String listReplyId) {
        try {
            // 1. Check for an active session for this user
            Optional<ChatbotFlowSession> activeSession = sessionRepository
                    .findFirstByInstituteIdAndUserPhoneAndStatusOrderByLastActivityAtDesc(
                            instituteId, userPhone, ChatbotSessionStatus.ACTIVE.name());

            if (activeSession.isPresent()) {
                ChatbotFlowSession session = activeSession.get();
                log.info("Resuming chatbot flow session: sessionId={}, flowId={}, currentNode={}",
                        session.getId(), session.getFlowId(), session.getCurrentNodeId());

                FlowExecutionContext context = buildContext(instituteId, channelType, userPhone,
                        userText, businessChannelId, messageType, buttonId, buttonPayload,
                        listReplyId, session);

                resumeSession(session, context);
                return true;
            }

            // 2. No active session — check if any ACTIVE flow has a matching trigger
            List<ChatbotFlow> activeFlows = new ArrayList<>(flowRepository
                    .findByInstituteIdAndChannelTypeAndStatus(instituteId, channelType,
                            ChatbotFlowStatus.ACTIVE.name()));

            // Also check flows with generic "WHATSAPP" channel type
            if (!channelType.equals("WHATSAPP")) {
                activeFlows.addAll(flowRepository.findByInstituteIdAndChannelTypeAndStatus(
                        instituteId, "WHATSAPP", ChatbotFlowStatus.ACTIVE.name()));
            }

            for (ChatbotFlow flow : activeFlows) {
                List<ChatbotFlowNode> triggerNodes = nodeRepository
                        .findByFlowIdAndNodeType(flow.getId(), ChatbotNodeType.TRIGGER.name());

                for (ChatbotFlowNode triggerNode : triggerNodes) {
                    ChatbotNodeExecutor executor = findExecutor(triggerNode.getNodeType());
                    if (executor == null) continue;

                    FlowExecutionContext context = buildContext(instituteId, channelType, userPhone,
                            userText, businessChannelId, messageType, buttonId, buttonPayload,
                            listReplyId, null);

                    NodeExecutionResult result = executor.execute(triggerNode, null, userText, context);
                    if (result.isSuccess()) {
                        log.info("Trigger matched for flow: flowId={}, trigger={}",
                                flow.getId(), triggerNode.getName());

                        // Create new session
                        ChatbotFlowSession session = ChatbotFlowSession.builder()
                                .flowId(flow.getId())
                                .instituteId(instituteId)
                                .userPhone(userPhone)
                                .currentNodeId(triggerNode.getId())
                                .status(ChatbotSessionStatus.ACTIVE.name())
                                .context(toJson(new HashMap<>()))
                                .lastActivityAt(new Timestamp(System.currentTimeMillis()))
                                .build();
                        session = sessionRepository.save(session);

                        // Advance past the trigger node to the next node(s)
                        context.setSessionVariables(new HashMap<>());
                        advanceToNextNodes(session, triggerNode.getId(), null, context, 0);
                        return true;
                    }
                }
            }

            // 3. No flow matched — fall back to legacy
            return false;

        } catch (Exception e) {
            log.error("Error in ChatbotFlowEngine.handleIncomingMessage: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Resume an existing session: execute the current node with user's input,
     * then advance to next nodes.
     */
    private void resumeSession(ChatbotFlowSession session, FlowExecutionContext context) {
        String currentNodeId = session.getCurrentNodeId();
        ChatbotFlowNode currentNode = nodeRepository.findById(currentNodeId).orElse(null);
        if (currentNode == null) {
            log.error("Current node not found: {}, completing session", currentNodeId);
            completeSession(session);
            return;
        }

        ChatbotNodeExecutor executor = findExecutor(currentNode.getNodeType());
        if (executor == null) {
            log.error("No executor for node type: {}", currentNode.getNodeType());
            completeSession(session);
            return;
        }

        NodeExecutionResult result = executor.execute(currentNode, session, context.getMessageText(), context);

        if (!result.isSuccess()) {
            log.warn("Node execution failed: nodeId={}, error={}", currentNodeId, result.getErrorMessage());
            // Don't complete session on failure — let user retry
            return;
        }

        // Merge output variables into session context
        mergeSessionContext(session, result.getOutputVariables());

        if (result.isWaitForInput()) {
            // Node needs more input (e.g., AI_RESPONSE in conversation mode)
            // Stay on this node, don't advance
            session.setLastActivityAt(new Timestamp(System.currentTimeMillis()));
            sessionRepository.save(session);
            return;
        }

        if (result.isScheduleDelay()) {
            // DELAY node: create a delayed task and pause
            ChatbotDelayTask delayTask = ChatbotDelayTask.builder()
                    .sessionId(session.getId())
                    .flowId(session.getFlowId())
                    .nextNodeId(currentNodeId) // Will resolve actual next node when firing
                    .fireAt(result.getDelayUntil())
                    .status("PENDING")
                    .build();
            delayTaskRepository.save(delayTask);

            session.setLastActivityAt(new Timestamp(System.currentTimeMillis()));
            sessionRepository.save(session);
            return;
        }

        // Advance to next node(s)
        advanceToNextNodes(session, currentNodeId, result.getSelectedBranchId(), context, 0);
    }

    /**
     * Follow outgoing edges from current node and execute subsequent nodes.
     * Handles branching (CONDITION) and linear flows.
     * Uses depth counter to prevent infinite loops in cyclic graphs.
     */
    private void advanceToNextNodes(ChatbotFlowSession session, String fromNodeId,
                                     String selectedBranchId, FlowExecutionContext context, int depth) {
        if (depth >= MAX_TRAVERSAL_DEPTH) {
            log.error("Max traversal depth ({}) reached for session {}, completing to prevent infinite loop",
                    MAX_TRAVERSAL_DEPTH, session.getId());
            completeSession(session);
            return;
        }

        List<ChatbotFlowEdge> outgoingEdges = edgeRepository.findBySourceNodeIdOrderBySortOrder(fromNodeId);

        if (outgoingEdges.isEmpty()) {
            // No more edges — flow complete
            completeSession(session);
            return;
        }

        // For CONDITION nodes: filter edges by branch ID
        ChatbotFlowEdge nextEdge = null;
        if (selectedBranchId != null) {
            nextEdge = outgoingEdges.stream()
                    .filter(e -> {
                        Map<String, Object> config = parseJson(e.getConditionConfig());
                        return config != null && selectedBranchId.equals(config.get("branchId"));
                    })
                    .findFirst()
                    // Fallback to default branch
                    .orElseGet(() -> outgoingEdges.stream()
                            .filter(e -> {
                                Map<String, Object> config = parseJson(e.getConditionConfig());
                                return config != null && Boolean.TRUE.equals(config.get("isDefault"));
                            })
                            .findFirst()
                            .orElse(outgoingEdges.isEmpty() ? null : outgoingEdges.get(0)));
        } else {
            // Non-branching node: take the first (and usually only) edge
            nextEdge = outgoingEdges.get(0);
        }

        if (nextEdge == null) {
            completeSession(session);
            return;
        }

        String nextNodeId = nextEdge.getTargetNodeId();
        ChatbotFlowNode nextNode = nodeRepository.findById(nextNodeId).orElse(null);
        if (nextNode == null) {
            log.error("Next node not found: {}", nextNodeId);
            completeSession(session);
            return;
        }

        // Update session to point to next node
        session.setCurrentNodeId(nextNodeId);
        session.setLastActivityAt(new Timestamp(System.currentTimeMillis()));
        sessionRepository.save(session);

        // Execute the next node if it's an "auto-execute" type (not waiting for input)
        if (isAutoExecuteNode(nextNode.getNodeType())) {
            ChatbotNodeExecutor executor = findExecutor(nextNode.getNodeType());
            if (executor != null) {
                NodeExecutionResult result = executor.execute(nextNode, session, null, context);
                if (result.isSuccess()) {
                    mergeSessionContext(session, result.getOutputVariables());

                    if (result.isWaitForInput()) {
                        // Node will wait for user input (e.g., CONDITION after sending interactive)
                        sessionRepository.save(session);
                        return;
                    }
                    if (result.isScheduleDelay()) {
                        ChatbotDelayTask delayTask = ChatbotDelayTask.builder()
                                .sessionId(session.getId())
                                .flowId(session.getFlowId())
                                .nextNodeId(nextNodeId)
                                .fireAt(result.getDelayUntil())
                                .status("PENDING")
                                .build();
                        delayTaskRepository.save(delayTask);
                        sessionRepository.save(session);
                        return;
                    }
                    // Continue advancing
                    advanceToNextNodes(session, nextNodeId, result.getSelectedBranchId(), context, depth + 1);
                }
            }
        }
        // If not auto-execute (CONDITION), session stays at this node waiting for input
    }

    /**
     * Nodes that execute immediately without waiting for user input.
     */
    private boolean isAutoExecuteNode(String nodeType) {
        return ChatbotNodeType.SEND_TEMPLATE.name().equals(nodeType)
                || ChatbotNodeType.SEND_INTERACTIVE.name().equals(nodeType)
                || ChatbotNodeType.WORKFLOW_ACTION.name().equals(nodeType)
                || ChatbotNodeType.DELAY.name().equals(nodeType)
                || ChatbotNodeType.HTTP_WEBHOOK.name().equals(nodeType);
    }

    /**
     * Resume execution after a DELAY task fires.
     */
    public void resumeAfterDelay(ChatbotDelayTask task) {
        ChatbotFlowSession session = sessionRepository.findById(task.getSessionId()).orElse(null);
        if (session == null || !ChatbotSessionStatus.ACTIVE.name().equals(session.getStatus())) {
            log.warn("Session not active for delay task: {}", task.getId());
            return;
        }

        FlowExecutionContext context = FlowExecutionContext.builder()
                .instituteId(session.getInstituteId())
                .phoneNumber(session.getUserPhone())
                .userId(session.getUserId())
                .sessionVariables(parseJson(session.getContext()))
                .build();

        advanceToNextNodes(session, task.getNextNodeId(), null, context, 0);
    }

    // ==================== Helpers ====================

    private ChatbotNodeExecutor findExecutor(String nodeType) {
        return executors.stream()
                .filter(e -> e.canHandle(nodeType))
                .findFirst()
                .orElse(null);
    }

    private void completeSession(ChatbotFlowSession session) {
        session.setStatus(ChatbotSessionStatus.COMPLETED.name());
        session.setCompletedAt(new Timestamp(System.currentTimeMillis()));
        sessionRepository.save(session);
        log.info("Flow session completed: sessionId={}", session.getId());
    }

    private void mergeSessionContext(ChatbotFlowSession session, Map<String, Object> newVars) {
        if (newVars == null || newVars.isEmpty()) return;
        Map<String, Object> existing = parseJson(session.getContext());
        if (existing == null) existing = new HashMap<>();
        existing.putAll(newVars);
        session.setContext(toJson(existing));
        sessionRepository.save(session);
    }

    private FlowExecutionContext buildContext(String instituteId, String channelType,
                                              String userPhone, String userText,
                                              String businessChannelId, String messageType,
                                              String buttonId, String buttonPayload,
                                              String listReplyId, ChatbotFlowSession session) {
        Map<String, Object> sessionVars = session != null ? parseJson(session.getContext()) : new HashMap<>();
        return FlowExecutionContext.builder()
                .instituteId(instituteId)
                .channelType(channelType)
                .phoneNumber(userPhone)
                .messageText(userText)
                .businessChannelId(businessChannelId)
                .messageType(messageType != null ? messageType : "text")
                .buttonId(buttonId)
                .buttonPayload(buttonPayload)
                .listReplyId(listReplyId)
                .sessionVariables(sessionVars != null ? sessionVars : new HashMap<>())
                .build();
    }

    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isBlank()) return new HashMap<>();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            return new HashMap<>();
        }
    }
}
