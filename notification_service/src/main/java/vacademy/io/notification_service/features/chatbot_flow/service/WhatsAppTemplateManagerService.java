package vacademy.io.notification_service.features.chatbot_flow.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import vacademy.io.notification_service.constants.NotificationConstants;
import vacademy.io.notification_service.features.chatbot_flow.dto.WhatsAppTemplateDTO;
import vacademy.io.notification_service.features.chatbot_flow.entity.WhatsAppTemplate;
import vacademy.io.notification_service.features.chatbot_flow.repository.WhatsAppTemplateRepository;
import vacademy.io.notification_service.institute.InstituteInfoDTO;
import vacademy.io.notification_service.institute.InstituteInternalService;

import java.sql.Timestamp;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class WhatsAppTemplateManagerService {

    private final WhatsAppTemplateRepository templateRepository;
    private final InstituteInternalService instituteInternalService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    // Pattern unused — remove to keep code clean

    // ==================== CRUD ====================

    @Transactional
    public WhatsAppTemplateDTO createDraft(WhatsAppTemplateDTO dto) {
        // Validate name: lowercase, underscores, no spaces (Meta requirement)
        String name = dto.getName().toLowerCase().replaceAll("[^a-z0-9_]", "_");
        String language = dto.getLanguage() != null ? dto.getLanguage() : "en";

        // Check for duplicate
        Optional<WhatsAppTemplate> existing = templateRepository
                .findByInstituteIdAndNameAndLanguage(dto.getInstituteId(), name, language);
        if (existing.isPresent() && !"DELETED".equals(existing.get().getStatus())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT,
                    "Template '" + name + "' already exists for language '" + language + "'");
        }

        WhatsAppTemplate template = WhatsAppTemplate.builder()
                .instituteId(dto.getInstituteId())
                .name(name)
                .language(dto.getLanguage() != null ? dto.getLanguage() : "en")
                .category(dto.getCategory())
                .status("DRAFT")
                .headerType(dto.getHeaderType() != null ? dto.getHeaderType() : "NONE")
                .headerText(dto.getHeaderText())
                .headerSampleUrl(dto.getHeaderSampleUrl())
                .bodyText(dto.getBodyText())
                .footerText(dto.getFooterText())
                .buttonsConfig(toJson(dto.getButtons()))
                .bodySampleValues(toJson(dto.getBodySampleValues()))
                .headerSampleValues(toJson(dto.getHeaderSampleValues()))
                .createdViaVacademy(true)
                .createdBy(dto.getCreatedBy())
                .build();

        template = templateRepository.save(template);
        return toDTO(template);
    }

    public WhatsAppTemplateDTO getById(String id) {
        WhatsAppTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found: " + id));
        return toDTO(template);
    }

    public List<WhatsAppTemplateDTO> getAll(String instituteId) {
        return templateRepository.findByInstituteIdOrderByUpdatedAtDesc(instituteId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional
    public WhatsAppTemplateDTO update(String id, WhatsAppTemplateDTO dto) {
        WhatsAppTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found: " + id));

        if (!"DRAFT".equals(template.getStatus()) && !"REJECTED".equals(template.getStatus())) {
            throw new RuntimeException("Can only edit DRAFT or REJECTED templates");
        }

        template.setName(dto.getName().toLowerCase().replaceAll("[^a-z0-9_]", "_"));
        template.setLanguage(dto.getLanguage());
        template.setCategory(dto.getCategory());
        template.setHeaderType(dto.getHeaderType());
        template.setHeaderText(dto.getHeaderText());
        template.setHeaderSampleUrl(dto.getHeaderSampleUrl());
        template.setBodyText(dto.getBodyText());
        template.setFooterText(dto.getFooterText());
        template.setButtonsConfig(toJson(dto.getButtons()));
        template.setBodySampleValues(toJson(dto.getBodySampleValues()));
        template.setHeaderSampleValues(toJson(dto.getHeaderSampleValues()));

        if ("REJECTED".equals(template.getStatus())) {
            template.setStatus("DRAFT");
            template.setRejectionReason(null);
        }

        template = templateRepository.save(template);
        return toDTO(template);
    }

    @Transactional
    public void delete(String id) {
        WhatsAppTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found: " + id));

        // If submitted to Meta, delete from Meta first
        if (template.getMetaTemplateId() != null && !"DRAFT".equals(template.getStatus())) {
            try {
                deleteFromMeta(template);
            } catch (Exception e) {
                log.warn("Failed to delete from Meta (continuing local delete): {}", e.getMessage());
            }
        }

        template.setStatus("DELETED");
        templateRepository.save(template);
    }

    // ==================== Meta API Integration ====================

    @Transactional
    public WhatsAppTemplateDTO submitToMeta(String id) {
        WhatsAppTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found: " + id));

        if (!"DRAFT".equals(template.getStatus()) && !"REJECTED".equals(template.getStatus())) {
            throw new RuntimeException("Can only submit DRAFT or REJECTED templates");
        }

        // Resolve Meta credentials
        MetaCredentials creds = resolveMetaCredentials(template.getInstituteId());
        if (creds == null) {
            throw new RuntimeException("Meta WhatsApp credentials not configured for this institute");
        }

        // Build Meta API payload
        Map<String, Object> payload = buildMetaTemplatePayload(template);

        try {
            String url = "https://graph.facebook.com/v22.0/" + creds.wabaId + "/message_templates";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(creds.accessToken);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode body = objectMapper.readTree(response.getBody());
                String metaTemplateId = body.path("id").asText(null);
                String metaStatus = body.path("status").asText("PENDING");

                template.setMetaTemplateId(metaTemplateId);
                template.setStatus(metaStatus.toUpperCase());
                template.setSubmittedAt(new Timestamp(System.currentTimeMillis()));

                if ("APPROVED".equalsIgnoreCase(metaStatus)) {
                    template.setApprovedAt(new Timestamp(System.currentTimeMillis()));
                }

                template = templateRepository.save(template);
                log.info("Template submitted to Meta: name={}, status={}, metaId={}",
                        template.getName(), template.getStatus(), metaTemplateId);
            } else {
                log.error("Meta template creation failed: {}", response.getBody());
                throw new RuntimeException("Meta API returned: " + response.getStatusCode());
            }
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to submit template to Meta: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to submit: " + e.getMessage());
        }

        return toDTO(template);
    }

    @Transactional
    public int syncFromMeta(String instituteId) {
        MetaCredentials creds = resolveMetaCredentials(instituteId);
        if (creds == null) {
            throw new RuntimeException("Meta WhatsApp credentials not configured");
        }

        try {
            String url = "https://graph.facebook.com/v22.0/" + creds.wabaId
                    + "/message_templates?limit=100&fields=name,language,status,category,components,rejected_reason";

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(creds.accessToken);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET,
                    new HttpEntity<>(headers), String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new RuntimeException("Meta API returned: " + response.getStatusCode());
            }

            JsonNode body = objectMapper.readTree(response.getBody());
            JsonNode data = body.path("data");
            if (!data.isArray()) return 0;

            int synced = 0;
            for (JsonNode tmpl : data) {
                String name = tmpl.path("name").asText();
                String language = tmpl.path("language").asText("en");
                String status = tmpl.path("status").asText("PENDING").toUpperCase();
                String category = tmpl.path("category").asText("");
                String metaId = tmpl.path("id").asText(null);
                String rejectedReason = tmpl.path("rejected_reason").asText(null);

                // Parse components to extract body/header/footer/buttons
                String bodyText = "";
                String headerType = "NONE";
                String headerText = null;
                String footerText = null;
                List<WhatsAppTemplateDTO.TemplateButton> buttons = new ArrayList<>();

                JsonNode components = tmpl.path("components");
                if (components.isArray()) {
                    for (JsonNode comp : components) {
                        String type = comp.path("type").asText("").toUpperCase();
                        switch (type) {
                            case "HEADER" -> {
                                headerType = comp.path("format").asText("TEXT").toUpperCase();
                                if ("TEXT".equals(headerType)) headerText = comp.path("text").asText(null);
                            }
                            case "BODY" -> bodyText = comp.path("text").asText("");
                            case "FOOTER" -> footerText = comp.path("text").asText(null);
                            case "BUTTONS" -> {
                                JsonNode btns = comp.path("buttons");
                                if (btns.isArray()) {
                                    for (JsonNode btn : btns) {
                                        buttons.add(WhatsAppTemplateDTO.TemplateButton.builder()
                                                .type(btn.path("type").asText(""))
                                                .text(btn.path("text").asText(""))
                                                .url(btn.path("url").asText(null))
                                                .phoneNumber(btn.path("phone_number").asText(null))
                                                .build());
                                    }
                                }
                            }
                        }
                    }
                }

                // Upsert: find existing or create new
                Optional<WhatsAppTemplate> existingOpt = templateRepository
                        .findByInstituteIdAndNameAndLanguage(instituteId, name, language);

                WhatsAppTemplate template;
                if (existingOpt.isPresent()) {
                    template = existingOpt.get();
                    template.setStatus(status);
                    template.setMetaTemplateId(metaId);
                    template.setCategory(category);
                    template.setRejectionReason(rejectedReason);
                    // Sync content from Meta (may have been edited externally)
                    template.setHeaderType(headerType);
                    template.setHeaderText(headerText);
                    template.setBodyText(bodyText);
                    template.setFooterText(footerText);
                    template.setButtonsConfig(toJson(buttons));
                    if ("APPROVED".equals(status) && template.getApprovedAt() == null) {
                        template.setApprovedAt(new Timestamp(System.currentTimeMillis()));
                    }
                } else {
                    template = WhatsAppTemplate.builder()
                            .instituteId(instituteId)
                            .metaTemplateId(metaId)
                            .name(name)
                            .language(language)
                            .category(category)
                            .status(status)
                            .rejectionReason(rejectedReason)
                            .headerType(headerType)
                            .headerText(headerText)
                            .bodyText(bodyText)
                            .footerText(footerText)
                            .buttonsConfig(toJson(buttons))
                            .createdViaVacademy(false)
                            .build();
                    if ("APPROVED".equals(status)) {
                        template.setApprovedAt(new Timestamp(System.currentTimeMillis()));
                    }
                }

                templateRepository.save(template);
                synced++;
            }

            log.info("Synced {} templates from Meta for institute {}", synced, instituteId);
            return synced;

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Sync failed: " + e.getMessage());
        }
    }

    // ==================== Helpers ====================

    private Map<String, Object> buildMetaTemplatePayload(WhatsAppTemplate template) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", template.getName());
        payload.put("language", template.getLanguage());
        payload.put("category", template.getCategory());

        List<Map<String, Object>> components = new ArrayList<>();

        // Header
        if (!"NONE".equals(template.getHeaderType())) {
            Map<String, Object> header = new LinkedHashMap<>();
            header.put("type", "HEADER");
            if ("TEXT".equals(template.getHeaderType())) {
                header.put("format", "TEXT");
                header.put("text", template.getHeaderText());
                // Add example if header has placeholders
                if (template.getHeaderSampleValues() != null) {
                    List<String> samples = fromJsonList(template.getHeaderSampleValues());
                    if (!samples.isEmpty()) {
                        // Meta expects: {"header_text": ["sample1"]} — flat list, NOT nested
                        header.put("example", Map.of("header_text", samples));
                    }
                }
            } else {
                header.put("format", template.getHeaderType()); // IMAGE, VIDEO, DOCUMENT
                // Note: Media headers require an upload handle from Meta's Resumable Upload API.
                // For now, we pass the URL and let the admin know if Meta rejects it.
                // A future improvement would implement the upload flow.
                if (template.getHeaderSampleUrl() != null && !template.getHeaderSampleUrl().isBlank()) {
                    header.put("example", Map.of("header_handle", List.of(template.getHeaderSampleUrl())));
                }
            }
            components.add(header);
        }

        // Body
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "BODY");
        body.put("text", template.getBodyText());
        // Add example if body has placeholders
        List<String> bodySamples = fromJsonList(template.getBodySampleValues());
        if (!bodySamples.isEmpty()) {
            body.put("example", Map.of("body_text", List.of(bodySamples)));
        }
        components.add(body);

        // Footer
        if (template.getFooterText() != null && !template.getFooterText().isBlank()) {
            components.add(Map.of("type", "FOOTER", "text", template.getFooterText()));
        }

        // Buttons
        List<WhatsAppTemplateDTO.TemplateButton> buttons = fromJsonButtons(template.getButtonsConfig());
        if (!buttons.isEmpty()) {
            List<Map<String, Object>> btnList = new ArrayList<>();
            for (WhatsAppTemplateDTO.TemplateButton btn : buttons) {
                Map<String, Object> btnMap = new LinkedHashMap<>();
                btnMap.put("type", btn.getType());
                btnMap.put("text", btn.getText());
                if ("URL".equals(btn.getType()) && btn.getUrl() != null) {
                    btnMap.put("url", btn.getUrl());
                    if (btn.getExample() != null && !btn.getExample().isEmpty()) {
                        btnMap.put("example", btn.getExample());
                    }
                }
                if ("PHONE_NUMBER".equals(btn.getType()) && btn.getPhoneNumber() != null) {
                    btnMap.put("phone_number", btn.getPhoneNumber());
                }
                btnList.add(btnMap);
            }
            components.add(Map.of("type", "BUTTONS", "buttons", btnList));
        }

        payload.put("components", components);
        return payload;
    }

    private void deleteFromMeta(WhatsAppTemplate template) {
        MetaCredentials creds = resolveMetaCredentials(template.getInstituteId());
        if (creds == null) return;

        String url = "https://graph.facebook.com/v22.0/" + creds.wabaId
                + "/message_templates?name=" + template.getName();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(creds.accessToken);

        restTemplate.exchange(url, HttpMethod.DELETE, new HttpEntity<>(headers), String.class);
        log.info("Deleted template from Meta: name={}", template.getName());
    }

    private MetaCredentials resolveMetaCredentials(String instituteId) {
        try {
            InstituteInfoDTO institute = instituteInternalService.getInstituteByInstituteId(instituteId);
            JsonNode root = objectMapper.readTree(institute.getSetting());

            JsonNode ws = root.path("setting")
                    .path(NotificationConstants.WHATSAPP_SETTING)
                    .path(NotificationConstants.DATA)
                    .path(NotificationConstants.UTILITY_WHATSAPP);
            if (ws.isMissingNode()) {
                ws = root.path(NotificationConstants.WHATSAPP_SETTING)
                        .path(NotificationConstants.DATA)
                        .path(NotificationConstants.UTILITY_WHATSAPP);
            }

            JsonNode meta = ws.path("meta");
            String accessToken = meta.path("access_token").asText(meta.path("accessToken").asText(
                    ws.path("access_token").asText(ws.path("accessToken").asText(""))));
            String wabaId = meta.path("wabaId").asText(meta.path("waba_id").asText(""));

            if (accessToken.isBlank() || wabaId.isBlank()) return null;
            return new MetaCredentials(accessToken, wabaId);
        } catch (Exception e) {
            log.error("Failed to resolve Meta credentials: {}", e.getMessage());
            return null;
        }
    }

    private WhatsAppTemplateDTO toDTO(WhatsAppTemplate t) {
        return WhatsAppTemplateDTO.builder()
                .id(t.getId())
                .instituteId(t.getInstituteId())
                .metaTemplateId(t.getMetaTemplateId())
                .name(t.getName())
                .language(t.getLanguage())
                .category(t.getCategory())
                .status(t.getStatus())
                .rejectionReason(t.getRejectionReason())
                .headerType(t.getHeaderType())
                .headerText(t.getHeaderText())
                .headerSampleUrl(t.getHeaderSampleUrl())
                .bodyText(t.getBodyText())
                .footerText(t.getFooterText())
                .buttons(fromJsonButtons(t.getButtonsConfig()))
                .bodySampleValues(fromJsonList(t.getBodySampleValues()))
                .headerSampleValues(fromJsonList(t.getHeaderSampleValues()))
                .createdViaVacademy(t.isCreatedViaVacademy())
                .createdBy(t.getCreatedBy())
                .createdAt(t.getCreatedAt() != null ? t.getCreatedAt().toString() : null)
                .submittedAt(t.getSubmittedAt() != null ? t.getSubmittedAt().toString() : null)
                .approvedAt(t.getApprovedAt() != null ? t.getApprovedAt().toString() : null)
                .build();
    }

    private String toJson(Object obj) {
        if (obj == null) return null;
        try { return objectMapper.writeValueAsString(obj); }
        catch (JsonProcessingException e) { return null; }
    }

    private List<String> fromJsonList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try { return objectMapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception e) { return List.of(); }
    }

    @SuppressWarnings("unchecked")
    private List<WhatsAppTemplateDTO.TemplateButton> fromJsonButtons(String json) {
        if (json == null || json.isBlank()) return List.of();
        try { return objectMapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception e) { return List.of(); }
    }

    private record MetaCredentials(String accessToken, String wabaId) {}
}
