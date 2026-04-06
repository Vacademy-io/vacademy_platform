package vacademy.io.notification_service.features.chatbot_flow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.chatbot_flow.dto.ChatbotFlowDTO;
import vacademy.io.notification_service.features.chatbot_flow.dto.ChatbotFlowSessionDTO;
import vacademy.io.notification_service.features.chatbot_flow.dto.FlowAnalyticsDTO;
import vacademy.io.notification_service.features.chatbot_flow.dto.WhatsAppTemplateInfoDTO;
import vacademy.io.notification_service.features.chatbot_flow.service.ChatbotFlowCrudService;
import vacademy.io.notification_service.features.chatbot_flow.service.ChatbotFlowMigrationService;
import vacademy.io.notification_service.features.chatbot_flow.service.ChatbotFlowSessionService;
import vacademy.io.notification_service.features.chatbot_flow.service.WhatsAppTemplateFetcher;

import java.util.List;

@RestController
@RequestMapping("/notification-service/v1/chatbot-flow")
@RequiredArgsConstructor
@Slf4j
public class ChatbotFlowController {

    private final ChatbotFlowCrudService crudService;
    private final WhatsAppTemplateFetcher templateFetcher;
    private final ChatbotFlowMigrationService migrationService;
    private final ChatbotFlowSessionService sessionService;

    @PostMapping
    public ResponseEntity<ChatbotFlowDTO> createFlow(@RequestBody ChatbotFlowDTO dto) {
        log.info("Creating chatbot flow: name={}, institute={}", dto.getName(), dto.getInstituteId());
        ChatbotFlowDTO created = crudService.createFlow(dto);
        return ResponseEntity.ok(created);
    }

    @GetMapping("/list")
    public ResponseEntity<List<ChatbotFlowDTO>> listFlows(
            @RequestParam String instituteId,
            @RequestParam(required = false) String status) {
        List<ChatbotFlowDTO> flows = crudService.listFlows(instituteId, status);
        return ResponseEntity.ok(flows);
    }

    @GetMapping("/{flowId}")
    public ResponseEntity<ChatbotFlowDTO> getFlow(@PathVariable String flowId) {
        ChatbotFlowDTO flow = crudService.getFlow(flowId);
        return ResponseEntity.ok(flow);
    }

    @PutMapping("/{flowId}")
    public ResponseEntity<ChatbotFlowDTO> updateFlow(
            @PathVariable String flowId,
            @RequestBody ChatbotFlowDTO dto) {
        log.info("Updating chatbot flow: id={}", flowId);
        ChatbotFlowDTO updated = crudService.updateFlow(flowId, dto);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{flowId}")
    public ResponseEntity<Void> deleteFlow(@PathVariable String flowId) {
        log.info("Archiving chatbot flow: id={}", flowId);
        crudService.deleteFlow(flowId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{flowId}/activate")
    public ResponseEntity<ChatbotFlowDTO> activateFlow(@PathVariable String flowId) {
        log.info("Activating chatbot flow: id={}", flowId);
        ChatbotFlowDTO activated = crudService.activateFlow(flowId);
        return ResponseEntity.ok(activated);
    }

    @PostMapping("/{flowId}/deactivate")
    public ResponseEntity<ChatbotFlowDTO> deactivateFlow(@PathVariable String flowId) {
        log.info("Deactivating chatbot flow: id={}", flowId);
        ChatbotFlowDTO deactivated = crudService.deactivateFlow(flowId);
        return ResponseEntity.ok(deactivated);
    }

    @PostMapping("/{flowId}/duplicate")
    public ResponseEntity<ChatbotFlowDTO> duplicateFlow(@PathVariable String flowId) {
        log.info("Duplicating chatbot flow: id={}", flowId);
        ChatbotFlowDTO duplicated = crudService.duplicateFlow(flowId);
        return ResponseEntity.ok(duplicated);
    }

    @GetMapping("/templates/whatsapp")
    public ResponseEntity<List<WhatsAppTemplateInfoDTO>> getWhatsAppTemplates(
            @RequestParam String instituteId) {
        log.info("Fetching WhatsApp templates for institute: {}", instituteId);
        List<WhatsAppTemplateInfoDTO> templates = templateFetcher.fetchTemplates(instituteId);
        return ResponseEntity.ok(templates);
    }

    @PostMapping("/migrate-legacy")
    public ResponseEntity<ChatbotFlowMigrationService.MigrationResult> migrateLegacyFlows() {
        log.info("Starting legacy ChannelFlowConfig migration");
        ChatbotFlowMigrationService.MigrationResult result = migrationService.migrateAll();
        log.info("Migration result: created={}, skipped={}, errors={}",
                result.created(), result.skipped(), result.errors().size());
        return ResponseEntity.ok(result);
    }

    // ==================== Sessions & Analytics ====================

    @GetMapping("/{flowId}/sessions")
    public ResponseEntity<List<ChatbotFlowSessionDTO>> listSessions(
            @PathVariable String flowId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<ChatbotFlowSessionDTO> sessions = sessionService.listSessions(flowId, status, page, size);
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<ChatbotFlowSessionDTO> getSessionDetail(@PathVariable String sessionId) {
        ChatbotFlowSessionDTO session = sessionService.getSessionDetail(sessionId);
        if (session == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(session);
    }

    @GetMapping("/{flowId}/analytics")
    public ResponseEntity<FlowAnalyticsDTO> getFlowAnalytics(@PathVariable String flowId) {
        FlowAnalyticsDTO analytics = sessionService.getFlowAnalytics(flowId);
        if (analytics == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(analytics);
    }

    @GetMapping("/analytics")
    public ResponseEntity<List<FlowAnalyticsDTO>> getInstituteAnalytics(@RequestParam String instituteId) {
        List<FlowAnalyticsDTO> analytics = sessionService.getInstituteAnalytics(instituteId);
        return ResponseEntity.ok(analytics);
    }
}
