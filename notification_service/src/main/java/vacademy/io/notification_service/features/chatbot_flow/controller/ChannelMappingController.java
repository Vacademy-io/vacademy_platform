package vacademy.io.notification_service.features.chatbot_flow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import vacademy.io.notification_service.features.combot.entity.ChannelToInstituteMapping;
import vacademy.io.notification_service.features.combot.repository.ChannelToInstituteMappingRepository;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * CRUD for channel_to_institute_mapping + webhook registration.
 * Creates the mapping so inbound webhooks route to the correct institute.
 * Optionally auto-registers webhook URL with WATI.
 */
@RestController
@RequestMapping("/notification-service/v1/channel-mapping")
@RequiredArgsConstructor
@Slf4j
public class ChannelMappingController {

    private final ChannelToInstituteMappingRepository mappingRepository;
    private final RestTemplate restTemplate;

    // ==================== CRUD ====================

    @PostMapping
    public ResponseEntity<ChannelToInstituteMapping> createMapping(@RequestBody Map<String, String> body) {
        String channelId = body.get("channelId");
        String channelType = body.get("channelType");
        String displayNumber = body.get("displayChannelNumber");
        String instituteId = body.get("instituteId");

        if (channelId == null || instituteId == null) {
            return ResponseEntity.badRequest().build();
        }

        // Upsert: update if exists, create if not
        ChannelToInstituteMapping mapping = mappingRepository.findById(channelId)
                .orElse(new ChannelToInstituteMapping());

        mapping.setChannelId(channelId);
        mapping.setChannelType(channelType != null ? channelType : "WHATSAPP_COMBOT");
        mapping.setDisplayChannelNumber(displayNumber);
        mapping.setInstituteId(instituteId);
        mapping.setActive(true);

        mapping = mappingRepository.save(mapping);
        log.info("Channel mapping saved: channelId={}, instituteId={}, type={}",
                channelId, instituteId, channelType);
        return ResponseEntity.ok(mapping);
    }

    @GetMapping
    public ResponseEntity<List<ChannelToInstituteMapping>> getMappings(@RequestParam String instituteId) {
        // findByInstituteId returns Optional, but we need all mappings
        // Use findAll and filter since repository only has findByInstituteId returning Optional
        Optional<ChannelToInstituteMapping> mapping = mappingRepository.findByInstituteId(instituteId);
        return ResponseEntity.ok(mapping.map(List::of).orElse(List.of()));
    }

    @DeleteMapping("/{channelId}")
    public ResponseEntity<Void> deleteMapping(@PathVariable String channelId) {
        mappingRepository.deleteById(channelId);
        log.info("Channel mapping deleted: channelId={}", channelId);
        return ResponseEntity.noContent().build();
    }

    // ==================== Webhook Registration ====================

    /**
     * Register webhook URL with WATI automatically.
     * WATI supports programmatic webhook setup via their API.
     */
    @PostMapping("/register-webhook/wati")
    public ResponseEntity<Map<String, Object>> registerWatiWebhook(@RequestBody Map<String, String> body) {
        String watiApiUrl = body.get("watiApiUrl");
        String watiApiKey = body.get("watiApiKey");
        String webhookUrl = body.get("webhookUrl");

        if (watiApiUrl == null || watiApiKey == null || webhookUrl == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Missing required fields"));
        }

        try {
            String url = watiApiUrl + "/api/v2/setWebhook";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + watiApiKey);

            Map<String, Object> payload = Map.of(
                    "url", webhookUrl,
                    "events", List.of("messages", "message_status", "message_template_status_update")
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

            boolean success = response.getStatusCode().is2xxSuccessful();
            log.info("WATI webhook registration: url={}, success={}", webhookUrl, success);

            return ResponseEntity.ok(Map.of(
                    "success", success,
                    "message", success ? "Webhook registered with WATI" : "WATI returned " + response.getStatusCode(),
                    "response", response.getBody() != null ? response.getBody() : ""
            ));

        } catch (Exception e) {
            log.error("Failed to register WATI webhook: {}", e.getMessage());
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "Failed: " + e.getMessage()
            ));
        }
    }

    /**
     * Verify that our webhook endpoint is reachable (self-test).
     */
    @PostMapping("/verify-webhook")
    public ResponseEntity<Map<String, Object>> verifyWebhook(@RequestBody Map<String, String> body) {
        String webhookUrl = body.get("webhookUrl");
        if (webhookUrl == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false));
        }

        try {
            // Send a GET with verify params to our own endpoint
            String testUrl = webhookUrl + "?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=vacademy_webhook_secret";
            ResponseEntity<String> response = restTemplate.getForEntity(testUrl, String.class);

            boolean success = response.getStatusCode().is2xxSuccessful()
                    && "test123".equals(response.getBody());

            return ResponseEntity.ok(Map.of(
                    "success", success,
                    "message", success ? "Webhook endpoint verified" : "Verification failed: " + response.getBody()
            ));

        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "Endpoint unreachable: " + e.getMessage()
            ));
        }
    }
}
