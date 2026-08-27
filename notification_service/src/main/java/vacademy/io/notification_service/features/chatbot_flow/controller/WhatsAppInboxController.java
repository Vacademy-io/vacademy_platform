package vacademy.io.notification_service.features.chatbot_flow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.chatbot_flow.dto.EscalationDTO;
import vacademy.io.notification_service.features.chatbot_flow.dto.InboxConversationDTO;
import vacademy.io.notification_service.features.chatbot_flow.dto.InboxMessageDTO;
import vacademy.io.notification_service.features.chatbot_flow.service.ChatbotEscalationService;
import vacademy.io.notification_service.features.chatbot_flow.service.WhatsAppInboxService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notification-service/v1/inbox")
@RequiredArgsConstructor
@Slf4j
public class WhatsAppInboxController {

    private final WhatsAppInboxService inboxService;
    private final ChatbotEscalationService escalationService;

    /**
     * @param filter UNANSWERED — only conversations the chatbot handed over that nobody has
     *               answered; FAILED — only conversations with an undelivered message; omitted
     *               or ALL — everything.
     */
    @GetMapping("/conversations")
    public ResponseEntity<List<InboxConversationDTO>> getConversations(
            @RequestParam String instituteId,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "30") int limit,
            @RequestParam(required = false) String filter) {
        List<InboxConversationDTO> conversations =
                inboxService.getConversations(instituteId, offset, limit, filter);
        return ResponseEntity.ok(conversations);
    }

    @GetMapping("/conversations/{phone}/messages")
    public ResponseEntity<List<InboxMessageDTO>> getMessages(
            @PathVariable String phone,
            @RequestParam String instituteId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit) {
        List<InboxMessageDTO> messages = inboxService.getMessages(phone, instituteId, cursor, limit);
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/conversations/search")
    public ResponseEntity<List<InboxConversationDTO>> searchConversations(
            @RequestParam String instituteId,
            @RequestParam String q) {
        List<InboxConversationDTO> results = inboxService.searchConversations(instituteId, q);
        return ResponseEntity.ok(results);
    }

    @PostMapping("/send")
    public ResponseEntity<InboxMessageDTO> sendReply(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        String text = body.get("text");
        String instituteId = body.get("instituteId");

        if (phone == null || text == null || instituteId == null) {
            return ResponseEntity.badRequest().build();
        }

        // Sending the reply also resolves any open escalation on this conversation.
        InboxMessageDTO sent = inboxService.sendReply(phone, text, instituteId, body.get("repliedBy"));
        return ResponseEntity.ok(sent);
    }

    // ==================== Escalations (learners waiting for a human) ====================

    /**
     * Conversations the chatbot handed over. Defaults to the open ones — that is the work list.
     */
    @GetMapping("/escalations")
    public ResponseEntity<List<EscalationDTO>> listEscalations(
            @RequestParam String instituteId,
            @RequestParam(defaultValue = "PENDING") String status) {
        List<EscalationDTO> escalations = escalationService.listEscalations(instituteId, status)
                .stream().map(EscalationDTO::from).toList();
        return ResponseEntity.ok(escalations);
    }

    /** Dismiss a hand-over without replying (handled on a call, no longer relevant, ...). */
    @PostMapping("/escalations/{escalationId}/resolve")
    public ResponseEntity<Map<String, Object>> resolveEscalation(
            @PathVariable String escalationId,
            @RequestBody(required = false) Map<String, String> body) {
        String resolvedBy = body != null ? body.get("resolvedBy") : null;
        boolean resolved = escalationService.resolveById(escalationId, resolvedBy);
        if (!resolved) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("id", escalationId, "status", "RESOLVED"));
    }
}
