package vacademy.io.notification_service.features.chatbot_flow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.chatbot_flow.dto.InboxConversationDTO;
import vacademy.io.notification_service.features.chatbot_flow.dto.InboxMessageDTO;
import vacademy.io.notification_service.features.chatbot_flow.service.WhatsAppInboxService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notification-service/v1/inbox")
@RequiredArgsConstructor
@Slf4j
public class WhatsAppInboxController {

    private final WhatsAppInboxService inboxService;

    @GetMapping("/conversations")
    public ResponseEntity<List<InboxConversationDTO>> getConversations(
            @RequestParam String instituteId,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "30") int limit) {
        List<InboxConversationDTO> conversations = inboxService.getConversations(instituteId, offset, limit);
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

        InboxMessageDTO sent = inboxService.sendReply(phone, text, instituteId);
        return ResponseEntity.ok(sent);
    }
}
