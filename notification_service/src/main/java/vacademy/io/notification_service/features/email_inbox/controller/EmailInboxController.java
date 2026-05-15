package vacademy.io.notification_service.features.email_inbox.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.email_inbox.dto.EmailConversationDTO;
import vacademy.io.notification_service.features.email_inbox.dto.EmailMessageDTO;
import vacademy.io.notification_service.features.email_inbox.dto.EmailReplyRequest;
import vacademy.io.notification_service.features.email_inbox.service.EmailInboxService;

import java.util.List;
import java.util.Map;

/**
 * Email inbox — conversations of outbound EMAIL + inbound INBOUND_EMAIL rows, grouped by
 * counterparty email and scoped to the institute via its configured from-addresses.
 * Mirrors {@code WhatsAppInboxController}.
 */
@Slf4j
@RestController
@RequestMapping("/notification-service/v1/email-inbox")
@RequiredArgsConstructor
public class EmailInboxController {

    private final EmailInboxService emailInboxService;

    @GetMapping("/conversations")
    public ResponseEntity<List<EmailConversationDTO>> getConversations(
            @RequestParam String instituteId,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "30") int limit,
            @RequestParam(required = false) String instituteAddress,
            @RequestParam(required = false) String direction) {
        return ResponseEntity.ok(emailInboxService.getConversations(
                instituteId, offset, limit, instituteAddress, direction));
    }

    @GetMapping("/conversations/{email}/messages")
    public ResponseEntity<List<EmailMessageDTO>> getMessages(
            @PathVariable String email,
            @RequestParam String instituteId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(required = false) String instituteAddress,
            @RequestParam(required = false) String direction) {
        return ResponseEntity.ok(emailInboxService.getMessages(
                instituteId, email, cursor, limit, instituteAddress, direction));
    }

    @GetMapping("/conversations/search")
    public ResponseEntity<List<EmailConversationDTO>> searchConversations(
            @RequestParam String instituteId,
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "30") int limit,
            @RequestParam(required = false) String instituteAddress,
            @RequestParam(required = false) String direction) {
        return ResponseEntity.ok(emailInboxService.searchConversations(
                instituteId, q, offset, limit, instituteAddress, direction));
    }

    @PostMapping("/reply")
    public ResponseEntity<EmailMessageDTO> sendReply(@RequestBody EmailReplyRequest request) {
        return ResponseEntity.ok(emailInboxService.sendReply(request));
    }

    /**
     * Lightweight gate: does this institute have inbound email wired up (active row in
     * email_address_mapping)? The UI hides the "Incoming" affordances when false.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Boolean>> getStatus(@RequestParam String instituteId) {
        return ResponseEntity.ok(Map.of(
                "inboundConfigured", emailInboxService.isInboundConfigured(instituteId)
        ));
    }

    /**
     * Configured institute sender addresses — used to populate the sender filter dropdown.
     */
    @GetMapping("/senders")
    public ResponseEntity<List<String>> getSenders(@RequestParam String instituteId) {
        return ResponseEntity.ok(emailInboxService.getInstituteSenderAddresses(instituteId));
    }
}
