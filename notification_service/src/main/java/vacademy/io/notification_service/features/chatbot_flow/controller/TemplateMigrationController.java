package vacademy.io.notification_service.features.chatbot_flow.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.chatbot_flow.entity.NotificationTemplate;
import vacademy.io.notification_service.features.chatbot_flow.repository.NotificationTemplateRepository;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import org.springframework.beans.factory.annotation.Value;

import java.util.*;

/**
 * One-time migration endpoint to copy email templates from admin-core's templates table
 * into notification-service's notification_template table.
 *
 * Call: POST /notification-service/internal/v1/migrate-templates?instituteId=xxx
 * This fetches templates from admin-core via internal API and inserts EMAIL ones locally.
 */
@RestController
@RequestMapping("/notification-service/internal/v1/migrate-templates")
@RequiredArgsConstructor
@Slf4j
public class TemplateMigrationController {

    private final NotificationTemplateRepository templateRepository;
    private final InternalClientUtils internalClientUtils;
    private final ObjectMapper objectMapper;

    @Value("${admin.core.baseurl:http://localhost:8081}")
    private String adminCoreBaseUrl;

    @PostMapping
    public ResponseEntity<Map<String, Object>> migrateTemplates(
            @RequestParam String instituteId) {

        log.info("Starting template migration for institute: {}", instituteId);

        try {
            // Fetch templates from admin-core via internal API
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    "notification_service",
                    HttpMethod.GET.name(),
                    adminCoreBaseUrl,
                    "/admin-core-service/institute/template/v1/institute/" + instituteId + "?page=0&size=1000",
                    null);

            if (response.getBody() == null) {
                return ResponseEntity.ok(Map.of("migrated", 0, "message", "No response from admin-core"));
            }

            JsonNode body = objectMapper.readTree(response.getBody());
            JsonNode content = body.has("content") ? body.get("content") : body;

            int migrated = 0;
            int skipped = 0;

            if (content.isArray()) {
                for (JsonNode templateNode : content) {
                    String type = templateNode.path("type").asText("");
                    String name = templateNode.path("name").asText("");
                    String id = templateNode.path("id").asText("");

                    // Only migrate EMAIL templates (WhatsApp already in notification_template via Meta sync)
                    if (!"EMAIL".equalsIgnoreCase(type)) {
                        skipped++;
                        continue;
                    }

                    // Check if already exists
                    Optional<NotificationTemplate> existing = templateRepository
                            .findByInstituteIdAndNameAndChannelType(instituteId, name, "EMAIL");
                    if (existing.isPresent()) {
                        skipped++;
                        continue;
                    }

                    NotificationTemplate template = NotificationTemplate.builder()
                            .id(id) // keep same ID for backward compat
                            .instituteId(instituteId)
                            .name(name)
                            .channelType("EMAIL")
                            .subject(templateNode.path("subject").asText(null))
                            .content(templateNode.path("content").asText(null))
                            .contentType(templateNode.path("contentType").asText("HTML"))
                            .dynamicParameters(templateNode.path("dynamicParameters").asText(null))
                            .status(templateNode.path("status").asText("ACTIVE"))
                            .templateCategory(templateNode.path("templateCategory").asText(null))
                            .canDelete(templateNode.path("canDelete").asBoolean(true))
                            .category("UTILITY")
                            .language("en")
                            .bodyText(name) // placeholder for required field
                            .createdViaVacademy(false)
                            .build();

                    templateRepository.save(template);
                    migrated++;
                    log.info("Migrated email template: name={}, id={}", name, id);
                }
            }

            log.info("Template migration completed for institute {}: migrated={}, skipped={}",
                    instituteId, migrated, skipped);

            return ResponseEntity.ok(Map.of(
                    "migrated", migrated,
                    "skipped", skipped,
                    "instituteId", instituteId
            ));

        } catch (Exception e) {
            log.error("Template migration failed for institute {}: {}", instituteId, e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", e.getMessage(),
                    "instituteId", instituteId
            ));
        }
    }
}
