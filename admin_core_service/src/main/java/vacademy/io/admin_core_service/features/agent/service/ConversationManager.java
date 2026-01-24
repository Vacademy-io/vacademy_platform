package vacademy.io.admin_core_service.features.agent.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.agent.dto.ConversationSession;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages conversation sessions with file-based persistence.
 * Sessions are kept in memory for fast access and persisted to log files.
 */
@Service
@Slf4j
public class ConversationManager {

    private static final String LOG_DIR = "./agent_logs";
    private static final int CONFIRMATION_TIMEOUT_MINUTES = 5;
    private static final int SESSION_EXPIRY_MINUTES = 30;

    // In-memory session store
    private final Map<String, ConversationSession> sessions = new ConcurrentHashMap<>();

    /**
     * Create a new session
     */
    public ConversationSession createSession(String userId, String instituteId, String model, String userToken) {
        String sessionId = UUID.randomUUID().toString();

        ConversationSession session = ConversationSession.create(
                sessionId, userId, instituteId, model, userToken);

        // Add system prompt
        session.addMessage(ConversationSession.ChatMessage.system(buildSystemPrompt()));

        sessions.put(sessionId, session);
        logSessionEvent(session, "SESSION_CREATED", null);

        log.info("[ConversationManager] Created session: {} for user: {}", sessionId, userId);
        return session;
    }

    /**
     * Get existing session
     */
    public ConversationSession getSession(String sessionId) {
        ConversationSession session = sessions.get(sessionId);

        if (session == null) {
            log.warn("[ConversationManager] Session not found: {}", sessionId);
            return null;
        }

        // Check expiry
        if (session.isExpired()) {
            log.info("[ConversationManager] Session expired: {}", sessionId);
            session.setState(ConversationSession.SessionState.TIMED_OUT);
            logSessionEvent(session, "SESSION_EXPIRED", null);
            return session;
        }

        return session;
    }

    /**
     * Update session
     */
    public void updateSession(ConversationSession session) {
        session.updateActivity();
        sessions.put(session.getSessionId(), session);
    }

    /**
     * Add user message to session
     */
    public void addUserMessage(ConversationSession session, String message) {
        session.addMessage(ConversationSession.ChatMessage.user(message));
        logSessionEvent(session, "USER_MESSAGE", message);
        updateSession(session);
    }

    /**
     * Add assistant message to session
     */
    public void addAssistantMessage(ConversationSession session, String message) {
        session.addMessage(ConversationSession.ChatMessage.assistant(message));
        logSessionEvent(session, "ASSISTANT_MESSAGE", message);
        updateSession(session);
    }

    /**
     * Add tool call to session
     */
    public void addToolCall(ConversationSession session, String toolCallId, String toolName, Object arguments) {
        session.addMessage(ConversationSession.ChatMessage.toolCall(toolCallId, toolName, arguments));
        logSessionEvent(session, "TOOL_CALL", toolName + ": " + arguments);
        updateSession(session);
    }

    /**
     * Add tool result to session
     */
    public void addToolResult(ConversationSession session, String toolCallId, String toolName, String result) {
        session.addMessage(ConversationSession.ChatMessage.toolResult(toolCallId, toolName, result));
        logSessionEvent(session, "TOOL_RESULT",
                toolName + ": " + (result != null ? result.substring(0, Math.min(200, result.length())) : "null"));
        updateSession(session);
    }

    /**
     * Set session to awaiting input state
     */
    public void setAwaitingInput(ConversationSession session) {
        session.setState(ConversationSession.SessionState.AWAITING_INPUT);
        session.setExpiresAt(LocalDateTime.now().plusMinutes(CONFIRMATION_TIMEOUT_MINUTES));
        logSessionEvent(session, "AWAITING_INPUT", null);
        updateSession(session);
    }

    /**
     * Resume session from awaiting input
     */
    public void resumeSession(ConversationSession session) {
        session.setState(ConversationSession.SessionState.ACTIVE);
        session.setExpiresAt(LocalDateTime.now().plusMinutes(SESSION_EXPIRY_MINUTES));
        logSessionEvent(session, "SESSION_RESUMED", null);
        updateSession(session);
    }

    /**
     * Complete session
     */
    public void completeSession(ConversationSession session) {
        session.setState(ConversationSession.SessionState.COMPLETED);
        logSessionEvent(session, "SESSION_COMPLETED", null);
        updateSession(session);
    }

    /**
     * Set session to error state
     */
    public void errorSession(ConversationSession session, String error) {
        session.setState(ConversationSession.SessionState.ERROR);
        logSessionEvent(session, "SESSION_ERROR", error);
        updateSession(session);
    }

    /**
     * Pin tools to session
     */
    public void pinTools(ConversationSession session, java.util.List<ConversationSession.ToolDefinition> tools) {
        session.setPinnedTools(tools);
        logSessionEvent(session, "TOOLS_PINNED", "Count: " + tools.size());
        updateSession(session);
    }

    /**
     * Build the system prompt for the agent
     */
    private String buildSystemPrompt() {
        return """
                You are an intelligent SaaS Agent for Vacademy, an educational platform.

                RULES:
                1. DEPENDENCIES: If a tool requires an ID (e.g., student_id, course_id) and you only have a Name,
                   YOU MUST find the ID first using search/list tools.

                2. CONFIRMATION: You MUST ask the user for confirmation before:
                   - Any DELETE operation
                   - Status changes (deactivate, suspend, etc.)
                   - Bulk operations affecting multiple records
                   - Enrollment/unenrollment operations
                   - Approval/rejection actions

                3. CHAINING: You are allowed to make multiple tool calls in sequence to achieve a goal.
                   For example: Search for student -> Get student ID -> Fetch student report

                4. CLARITY: When asking for confirmation, clearly explain:
                   - What action you're about to take
                   - What data will be affected
                   - The consequences of the action

                5. CONTEXT: The user is working within an institute. Use the provided instituteId for all queries.

                6. ERROR HANDLING: If a tool call fails, explain the error to the user and suggest alternatives.

                7. SEARCH DISAMBIGUATION: If a search returns multiple results, present them to the user
                   and ask which one they meant.

                8. LIMITATIONS: If you cannot perform an action due to missing information or permissions,
                   clearly explain what's needed.

                Always be helpful, clear, and confirm before taking any destructive or significant action.
                """;
    }

    /**
     * Log session event to file
     */
    private void logSessionEvent(ConversationSession session, String eventType, String details) {
        try {
            Path logDir = Paths.get(LOG_DIR);
            if (!Files.exists(logDir)) {
                Files.createDirectories(logDir);
            }

            String logFileName = "session_" + session.getSessionId() + ".log";
            Path logFile = logDir.resolve(logFileName);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            String logEntry = String.format("[%s] [%s] %s: %s%n",
                    timestamp,
                    session.getSessionId().substring(0, 8),
                    eventType,
                    details != null ? details : "");

            Files.write(logFile, logEntry.getBytes(),
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND);

        } catch (IOException e) {
            log.error("[ConversationManager] Error writing to log file: {}", e.getMessage());
        }
    }

    /**
     * Cleanup expired sessions (can be called by a scheduled task)
     */
    public void cleanupExpiredSessions() {
        sessions.entrySet().removeIf(entry -> {
            ConversationSession session = entry.getValue();
            if (session.isExpired()) {
                log.info("[ConversationManager] Removing expired session: {}", entry.getKey());
                return true;
            }
            return false;
        });
    }
}
