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
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
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
    private final NotificationLogRepository notificationLogRepository;
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

                // Check if current node is a CONDITION or AI_RESPONSE (waiting for input)
                ChatbotFlowNode currentNode = session.getCurrentNodeId() != null
                        ? nodeRepository.findById(session.getCurrentNodeId()).orElse(null) : null;
                boolean isWaitingNode = currentNode != null && (
                        ChatbotNodeType.CONDITION.name().equals(currentNode.getNodeType())
                        || ChatbotNodeType.AI_RESPONSE.name().equals(currentNode.getNodeType()));

                if (isWaitingNode) {
                    // Session is waiting for user input on a CONDITION/AI_RESPONSE node.
                    // FIRST try to resume the session with this input — the CONDITION node
                    // will evaluate whether the input matches one of its branches.
                    FlowExecutionContext context = buildContext(instituteId, channelType, userPhone,
                            userText, businessChannelId, messageType, buttonId, buttonPayload,
                            listReplyId, session);

                    // Try executing the node with the user's input
                    ChatbotNodeExecutor executor = findExecutor(currentNode.getNodeType());
                    if (executor != null) {
                        NodeExecutionResult condResult = executor.execute(currentNode, session,
                                userText, context);
                        if (condResult.isSuccess()) {
                            // Always merge output variables (e.g., AI conversation history)
                            mergeSessionContext(session, condResult.getOutputVariables());

                            if (condResult.isWaitForInput()) {
                                // Node wants to stay in conversation mode (AI_RESPONSE)
                                // History is already saved via mergeSessionContext above
                                session.setLastActivityAt(new Timestamp(System.currentTimeMillis()));
                                sessionRepository.save(session);
                                return true;
                            }

                            // Condition matched a branch — advance to next node
                            log.info("Node matched branch in active session — resuming flow: "
                                    + "sessionId={}, branchId={}",
                                    session.getId(), condResult.getSelectedBranchId());
                            advanceToNextNodes(session, currentNode.getId(),
                                    condResult.getSelectedBranchId(), context, 0);
                            return true;
                        }
                    }

                    // Node execution failed or condition didn't match any branch.
                    // Check if input matches ANY flow's trigger (including current flow).
                    // If it matches, restart — the user is clearly trying to start over.
                    String matchedFlowId = findMatchingTriggerFlowId(instituteId, channelType,
                            userText, messageType, buttonId, buttonPayload, listReplyId);

                    if (matchedFlowId != null) {
                        log.info("Input matches trigger for flow={} while stuck on {} node "
                                + "— restarting session", matchedFlowId, currentNode.getNodeType());
                        completeSession(session);
                        // Fall through to trigger matching below to start a new flow
                    } else {
                        // No trigger matches — stay on current node waiting for valid input
                        log.info("No trigger matched — staying on current {} node: sessionId={}",
                                currentNode.getNodeType(), session.getId());
                        return true;
                    }
                } else {
                    // Not on a waiting node — check if a trigger keyword matches to restart
                    boolean matchesTrigger = doesMessageMatchAnyTrigger(instituteId, channelType,
                            userText, messageType, buttonId, buttonPayload, listReplyId);

                    if (matchesTrigger) {
                        // Not on a waiting node, just resume normally
                        FlowExecutionContext context = buildContext(instituteId, channelType, userPhone,
                                userText, businessChannelId, messageType, buttonId, buttonPayload,
                                listReplyId, session);
                        resumeSession(session, context);
                        return true;
                    } else {
                        // Message doesn't match any trigger — resume current session
                        log.info("Resuming chatbot flow session: sessionId={}, flowId={}, currentNode={}",
                                session.getId(), session.getFlowId(), session.getCurrentNodeId());

                        FlowExecutionContext context = buildContext(instituteId, channelType, userPhone,
                                userText, businessChannelId, messageType, buttonId, buttonPayload,
                                listReplyId, session);

                        resumeSession(session, context);
                        return true;
                    }
                }
            }

            // 2. No active session — check if any ACTIVE flow has a matching trigger
            // Search across all WhatsApp channel types for this institute:
            // exact match first, then generic "WHATSAPP", then other WA variants
            List<ChatbotFlow> activeFlows = new ArrayList<>(flowRepository
                    .findByInstituteIdAndChannelTypeAndStatus(instituteId, channelType,
                            ChatbotFlowStatus.ACTIVE.name()));

            // Also check flows with generic "WHATSAPP" channel type
            if (!channelType.equals("WHATSAPP")) {
                activeFlows.addAll(flowRepository.findByInstituteIdAndChannelTypeAndStatus(
                        instituteId, "WHATSAPP", ChatbotFlowStatus.ACTIVE.name()));
            }

            // Cross-provider fallback: a flow built for WATI should also fire for META and vice versa
            // (the flow logic is provider-agnostic, only the send mechanism differs)
            for (String fallbackType : List.of("WHATSAPP_META", "WHATSAPP_WATI", "WHATSAPP_COMBOT")) {
                if (!fallbackType.equals(channelType)) {
                    activeFlows.addAll(flowRepository.findByInstituteIdAndChannelTypeAndStatus(
                            instituteId, fallbackType, ChatbotFlowStatus.ACTIVE.name()));
                }
            }

            // Deduplicate by flow ID (in case same flow was found through multiple channel type queries)
            Set<String> seenFlowIds = new HashSet<>();
            activeFlows.removeIf(f -> !seenFlowIds.add(f.getId()));

            log.info("Found {} active flows for institute={}, channelType={}", activeFlows.size(), instituteId, channelType);

            // Collect all matching triggers with their priority, then pick the highest
            record MatchedTrigger(ChatbotFlow flow, ChatbotFlowNode triggerNode, int priority,
                                  boolean isSpecific) {}
            List<MatchedTrigger> matchedTriggers = new ArrayList<>();

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
                        Map<String, Object> triggerConfig = parseJson(triggerNode.getConfig());
                        int priority = 0;
                        boolean isSpecific = false;
                        if (triggerConfig != null) {
                            Object p = triggerConfig.get("priority");
                            if (p instanceof Number) priority = ((Number) p).intValue();
                            // A trigger with actual keywords is "specific"; one without is catch-all
                            Object keywords = triggerConfig.get("keywords");
                            isSpecific = keywords instanceof List && !((List<?>) keywords).isEmpty();
                        }
                        matchedTriggers.add(new MatchedTrigger(flow, triggerNode, priority, isSpecific));
                    }
                }
            }

            if (!matchedTriggers.isEmpty()) {
                // Sort: specific triggers first, then by priority descending
                matchedTriggers.sort((a, b) -> {
                    if (a.isSpecific() != b.isSpecific()) return a.isSpecific() ? -1 : 1;
                    return Integer.compare(b.priority(), a.priority());
                });

                MatchedTrigger best = matchedTriggers.get(0);
                log.info("Trigger matched for flow: flowId={}, trigger={}, priority={}, specific={}",
                        best.flow().getId(), best.triggerNode().getName(),
                        best.priority(), best.isSpecific());

                // Create new session
                FlowExecutionContext context = buildContext(instituteId, channelType, userPhone,
                        userText, businessChannelId, messageType, buttonId, buttonPayload,
                        listReplyId, null);

                ChatbotFlowSession session = ChatbotFlowSession.builder()
                        .flowId(best.flow().getId())
                        .instituteId(instituteId)
                        .userPhone(userPhone)
                        .channelType(channelType)
                        .businessChannelId(businessChannelId)
                        .currentNodeId(best.triggerNode().getId())
                        .status(ChatbotSessionStatus.ACTIVE.name())
                        .context(toJson(new HashMap<>()))
                        .lastActivityAt(new Timestamp(System.currentTimeMillis()))
                        .build();
                session = sessionRepository.save(session);

                // Advance past the trigger node to the next node(s)
                context.setSessionVariables(new HashMap<>());
                advanceToNextNodes(session, best.triggerNode().getId(), null, context, 0);
                return true;
            }

            // 3. No flow matched — fall back to legacy
            log.info("No chatbot flow matched for phone={}, institute={}, text='{}'",
                    userPhone, instituteId, userText != null ? userText.substring(0, Math.min(userText.length(), 30)) : "null");
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
            log.error("Current node not found: nodeId={}, sessionId={}, flowId={} — "
                    + "likely flow was edited while session was active. Completing session.",
                    currentNodeId, session.getId(), session.getFlowId());
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

        // Log outgoing message so it appears in WhatsApp Inbox
        logOutgoingMessage(currentNode, context, result);

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
                NodeExecutionResult result = executor.execute(nextNode, session, context.getMessageText(), context);
                if (result.isSuccess()) {
                    // Log outgoing message so it appears in WhatsApp Inbox
                    logOutgoingMessage(nextNode, context, result);
                    mergeSessionContext(session, result.getOutputVariables());

                    if (result.isWaitForInput()) {
                        // Node will wait for user input (e.g., CONDITION after sending interactive)
                        sessionRepository.save(session);
                        return;
                    }
                    if (result.isScheduleDelay()) {
                        // Store the DELAY node's own ID — resumeAfterDelay calls
                        // advanceToNextNodes(storedId) which finds outgoing edges
                        // from this node and executes the target. Storing nextNodeId
                        // here would SKIP the target and jump two nodes ahead.
                        ChatbotDelayTask delayTask = ChatbotDelayTask.builder()
                                .sessionId(session.getId())
                                .flowId(session.getFlowId())
                                .nextNodeId(nextNodeId)  // This IS the delay node (set at line 365)
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
                || ChatbotNodeType.SEND_MESSAGE.name().equals(nodeType)
                || ChatbotNodeType.SEND_INTERACTIVE.name().equals(nodeType)
                || ChatbotNodeType.WORKFLOW_ACTION.name().equals(nodeType)
                || ChatbotNodeType.DELAY.name().equals(nodeType)
                || ChatbotNodeType.HTTP_WEBHOOK.name().equals(nodeType)
                || ChatbotNodeType.AI_RESPONSE.name().equals(nodeType);
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
                .channelType(session.getChannelType())
                .businessChannelId(session.getBusinessChannelId())
                .sessionVariables(parseJson(session.getContext()))
                .build();

        advanceToNextNodes(session, task.getNextNodeId(), null, context, 0);
    }

    // ==================== Helpers ====================

    /**
     * Check if the incoming message matches ANY active flow's trigger for this institute.
     * Used to decide if an active session should be restarted.
     */
    private boolean doesMessageMatchAnyTrigger(String instituteId, String channelType,
                                                String userText, String messageType,
                                                String buttonId, String buttonPayload, String listReplyId) {
        return findMatchingTriggerFlowId(instituteId, channelType, userText,
                messageType, buttonId, buttonPayload, listReplyId) != null;
    }

    /**
     * Find the flow ID of the best matching trigger for this message.
     * Returns the flow ID of the highest-priority, most-specific matching trigger,
     * or null if no trigger matches.
     */
    private String findMatchingTriggerFlowId(String instituteId, String channelType,
                                             String userText, String messageType,
                                             String buttonId, String buttonPayload, String listReplyId) {
        // Collect all active flows (same logic as main trigger scan)
        List<ChatbotFlow> activeFlows = new ArrayList<>(flowRepository
                .findByInstituteIdAndChannelTypeAndStatus(instituteId, channelType,
                        ChatbotFlowStatus.ACTIVE.name()));
        if (!channelType.equals("WHATSAPP")) {
            activeFlows.addAll(flowRepository.findByInstituteIdAndChannelTypeAndStatus(
                    instituteId, "WHATSAPP", ChatbotFlowStatus.ACTIVE.name()));
        }
        for (String fallbackType : List.of("WHATSAPP_META", "WHATSAPP_WATI", "WHATSAPP_COMBOT")) {
            if (!fallbackType.equals(channelType)) {
                activeFlows.addAll(flowRepository.findByInstituteIdAndChannelTypeAndStatus(
                        instituteId, fallbackType, ChatbotFlowStatus.ACTIVE.name()));
            }
        }

        FlowExecutionContext ctx = FlowExecutionContext.builder()
                .messageType(messageType).buttonId(buttonId)
                .buttonPayload(buttonPayload).listReplyId(listReplyId)
                .build();

        // Track the best matching trigger: prefer specific (has keywords) over catch-all,
        // then by priority
        String bestFlowId = null;
        int bestPriority = Integer.MIN_VALUE;
        boolean bestIsSpecific = false;

        for (ChatbotFlow flow : activeFlows) {
            List<ChatbotFlowNode> triggerNodes = nodeRepository
                    .findByFlowIdAndNodeType(flow.getId(), ChatbotNodeType.TRIGGER.name());
            for (ChatbotFlowNode triggerNode : triggerNodes) {
                ChatbotNodeExecutor executor = findExecutor(triggerNode.getNodeType());
                if (executor != null) {
                    NodeExecutionResult result = executor.execute(triggerNode, null, userText, ctx);
                    if (result.isSuccess()) {
                        Map<String, Object> triggerConfig = parseJson(triggerNode.getConfig());
                        int priority = 0;
                        boolean isSpecific = false;
                        if (triggerConfig != null) {
                            Object p = triggerConfig.get("priority");
                            if (p instanceof Number) priority = ((Number) p).intValue();
                            Object keywords = triggerConfig.get("keywords");
                            isSpecific = keywords instanceof List && !((List<?>) keywords).isEmpty();
                        }

                        // Better match if: (a) this is specific and best isn't, or
                        // (b) same specificity but higher priority
                        if ((!bestIsSpecific && isSpecific)
                                || (isSpecific == bestIsSpecific && priority > bestPriority)
                                || bestFlowId == null) {
                            bestFlowId = flow.getId();
                            bestPriority = priority;
                            bestIsSpecific = isSpecific;
                        }
                    }
                }
            }
        }
        return bestFlowId;
    }

    /**
     * Log outgoing messages from SEND_* and AI_RESPONSE nodes so they appear in WhatsApp Inbox.
     */
    private void logOutgoingMessage(ChatbotFlowNode node, FlowExecutionContext context,
                                     NodeExecutionResult result) {
        try {
            String nodeType = node.getNodeType();
            // Only log for send nodes and AI response
            if (!nodeType.startsWith("SEND_") && !ChatbotNodeType.AI_RESPONSE.name().equals(nodeType)) {
                return;
            }

            // Extract the actual message body that was sent
            String messageBody = node.getName();

            // For AI_RESPONSE: use the actual LLM-generated reply from output variables
            if (ChatbotNodeType.AI_RESPONSE.name().equals(nodeType)
                    && result != null && result.getOutputVariables() != null) {
                Object aiReply = result.getOutputVariables().get("ai_last_response");
                if (aiReply != null) {
                    messageBody = aiReply.toString();
                }
            } else {
                // For SEND_* nodes: extract from config
                Map<String, Object> config = parseJson(node.getConfig());
                if (config != null) {
                    if (config.containsKey("text")) {
                        messageBody = (String) config.get("text");
                    } else if (config.containsKey("templateName")) {
                        messageBody = "Template: " + config.get("templateName");
                    } else if (config.containsKey("body")) {
                        messageBody = (String) config.get("body");
                    } else if (config.containsKey("mediaUrl")) {
                        messageBody = "[" + config.getOrDefault("messageType", "media") + "] "
                                + config.getOrDefault("mediaCaption", config.get("mediaUrl"));
                    }
                }
            }

            NotificationLog outLog = new NotificationLog();
            outLog.setNotificationType("WHATSAPP_MESSAGE_OUTGOING");
            outLog.setChannelId(context.getPhoneNumber());
            outLog.setBody(messageBody);
            outLog.setSource("CHATBOT_FLOW");
            outLog.setSenderBusinessChannelId(context.getBusinessChannelId());
            outLog.setNotificationDate(LocalDateTime.now());
            outLog.setUserId(context.getUserId());

            notificationLogRepository.save(outLog);
        } catch (Exception e) {
            log.warn("Failed to log outgoing message for node {}: {}", node.getId(), e.getMessage());
        }
    }

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
