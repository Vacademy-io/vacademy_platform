package vacademy.io.admin_core_service.features.agent.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.admin_core_service.features.agent.dto.*;
import vacademy.io.admin_core_service.features.agent.service.AgentOrchestrator;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * REST Controller for AI Agent interactions.
 * Provides endpoints for:
 * - Starting chat sessions
 * - Subscribing to SSE streams
 * - Responding to agent confirmations
 */
@RestController
@RequestMapping("/admin-core-service/v1/agent")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "AI Agent", description = "APIs for AI Agent interactions with ReAct loop")
public class AgentController {

    private final AgentOrchestrator agentOrchestrator;

    /**
     * Start a new chat or continue an existing session.
     * Returns immediately with session ID. Subscribe to SSE for updates.
     */
    @PostMapping("/chat")
    @Operation(summary = "Start or continue agent chat", description = "Initiates a new agent session or continues an existing one. "
            +
            "Returns session ID immediately. Subscribe to /stream/{sessionId} for real-time updates.")
    public ResponseEntity<AgentChatResponse> chat(
            @Valid @RequestBody AgentChatRequest request,
            @RequestAttribute(value = "user", required = false) CustomUserDetails userDetails,
            HttpServletRequest httpRequest) {

        log.info("[AgentController] Chat request received. SessionId: {}, Message: {}",
                request.getSessionId(),
                request.getMessage().substring(0, Math.min(50, request.getMessage().length())));

        // Get user ID from authentication
        String userId = userDetails != null ? userDetails.getId() : "anonymous";

        // Get JWT token for API calls
        String token = extractToken(httpRequest);

        AgentChatResponse response = agentOrchestrator.startChat(request, userId, token);

        return ResponseEntity.ok(response);
    }

    /**
     * Subscribe to SSE stream for real-time agent updates.
     * This should be called immediately after /chat returns.
     */
    @GetMapping(value = "/stream/{sessionId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Subscribe to agent stream", description = "SSE endpoint for receiving real-time agent updates. "
            +
            "Events include: THINKING, TOOL_CALL, TOOL_RESULT, MESSAGE, AWAITING_INPUT, COMPLETE, ERROR")
    public SseEmitter stream(@PathVariable String sessionId) {
        log.info("[AgentController] SSE subscription for session: {}", sessionId);
        return agentOrchestrator.subscribeToStream(sessionId);
    }

    /**
     * Respond to an agent's confirmation request.
     * Use when agent is in AWAITING_INPUT state.
     */
    @PostMapping("/respond/{sessionId}")
    @Operation(summary = "Respond to agent confirmation", description = "Send user's response to agent's confirmation request. "
            +
            "Agent will continue processing and updates will be sent via SSE.")
    public ResponseEntity<AgentChatResponse> respond(
            @PathVariable String sessionId,
            @Valid @RequestBody AgentRespondRequest request,
            @RequestAttribute(value = "user", required = false) CustomUserDetails userDetails) {

        log.info("[AgentController] User response for session: {}, Response: {}",
                sessionId, request.getResponse());

        AgentChatResponse response = agentOrchestrator.respondToAgent(sessionId, request);

        return ResponseEntity.ok(response);
    }

    /**
     * Get session status (for debugging/monitoring)
     */
    @GetMapping("/session/{sessionId}/status")
    @Operation(summary = "Get session status", description = "Returns the current state of an agent session")
    public ResponseEntity<SessionStatus> getSessionStatus(@PathVariable String sessionId) {
        // TODO: Implement session status retrieval
        return ResponseEntity.ok(SessionStatus.builder()
                .sessionId(sessionId)
                .message("Session status endpoint - implementation pending")
                .build());
    }

    /**
     * Extract JWT token from request
     */
    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }

    /**
     * Simple session status DTO
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class SessionStatus {
        private String sessionId;
        private String state;
        private String message;
    }
}
