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

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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
                .bodyVariableNames(toJson(dto.getBodyVariableNames()))
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
        template.setBodyVariableNames(toJson(dto.getBodyVariableNames()));
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

        // For media headers (IMAGE/VIDEO/DOCUMENT), Meta requires an upload
        // handle obtained via the Resumable Upload API — a public URL is NOT
        // accepted (subcode 2388273). Upload the sample media now and use the
        // returned handle in the template payload.
        String headerHandle = null;
        String headerType = template.getHeaderType();
        boolean needsHandle = headerType != null
                && !"NONE".equals(headerType)
                && !"TEXT".equals(headerType);
        if (needsHandle) {
            String sampleUrl = template.getHeaderSampleUrl();
            if (sampleUrl == null || sampleUrl.isBlank()) {
                throw new RuntimeException("A sample media URL is required for "
                        + headerType + " header templates. Please upload a sample.");
            }
            if (creds.appId == null || creds.appId.isBlank()) {
                throw new RuntimeException("Meta app_id is not configured for this institute. "
                        + "It is required to upload sample media for " + headerType + " header templates.");
            }
            // uploadHeaderMediaToMeta throws with a descriptive message that
            // includes Meta's response body / error subcode so admins can see
            // exactly what went wrong (e.g. bad app_id, missing scope on the
            // access token, unsupported file type).
            headerHandle = uploadHeaderMediaToMeta(sampleUrl, creds, headerType);
        }

        // Build Meta API payload
        Map<String, Object> payload = buildMetaTemplatePayload(template, headerHandle);

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
        // Detect provider from institute settings
        String provider = detectProvider(instituteId);

        return switch (provider) {
            case "WATI" -> syncFromWati(instituteId);
            default -> syncFromMetaDirect(instituteId);
        };
    }

    /**
     * Detect the WhatsApp provider configured for this institute.
     */
    private String detectProvider(String instituteId) {
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

            return ws.path("provider").asText("META").toUpperCase();
        } catch (Exception e) {
            log.warn("Failed to detect provider, defaulting to META: {}", e.getMessage());
            return "META";
        }
    }

    private int syncFromMetaDirect(String instituteId) {
        MetaCredentials creds = resolveMetaCredentials(instituteId);
        if (creds == null) {
            throw new RuntimeException("Meta WhatsApp credentials not configured");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(creds.accessToken);

            String url = "https://graph.facebook.com/v22.0/" + creds.wabaId
                    + "/message_templates?limit=100&fields=name,language,status,category,components,rejected_reason";

            int synced = 0;

            // Paginate through all pages of Meta templates
            while (url != null) {
                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET,
                        new HttpEntity<>(headers), String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new RuntimeException("Meta API returned: " + response.getStatusCode());
            }

                JsonNode body = objectMapper.readTree(response.getBody());
                JsonNode data = body.path("data");
                if (!data.isArray()) break;

                for (JsonNode tmpl : data) {
                    syncSingleMetaTemplate(instituteId, tmpl);
                    synced++;
                }

                // Follow pagination cursor if present
                url = body.path("paging").path("next").asText(null);
            }

            log.info("Synced {} templates from Meta for institute {}", synced, instituteId);
            return synced;

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Sync failed: " + e.getMessage());
        }
    }

    private void syncSingleMetaTemplate(String instituteId, JsonNode tmpl) {
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
    }

    /**
     * Sync templates from WATI API: GET /api/v1/getMessageTemplates
     * Upserts templates into the local DB the same way Meta sync does.
     */
    private int syncFromWati(String instituteId) {
        WatiCredentials watiCreds = resolveWatiCredentials(instituteId);
        if (watiCreds == null) {
            throw new RuntimeException("WATI WhatsApp credentials not configured");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + watiCreds.apiKey);

            int pageSize = 100;
            int pageNumber = 1;
            int synced = 0;

            // Paginate through all pages of WATI templates
            while (true) {
                String url = watiCreds.apiUrl + "/api/v1/getMessageTemplates?pageSize=" + pageSize
                        + "&pageNumber=" + pageNumber;

                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET,
                        new HttpEntity<>(headers), String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new RuntimeException("WATI API returned: " + response.getStatusCode());
            }

                JsonNode body = objectMapper.readTree(response.getBody());
                // WATI returns: { "messageTemplates": [...] } or { "result": [...] }
                JsonNode templateArray = body.path("messageTemplates");
                if (!templateArray.isArray()) {
                    templateArray = body.path("result");
                }
                if (!templateArray.isArray() || templateArray.isEmpty()) break;

                for (JsonNode tmpl : templateArray) {
                    syncSingleWatiTemplate(instituteId, tmpl);
                    synced++;
                }

                // If we got fewer than pageSize, we've reached the last page
                if (templateArray.size() < pageSize) break;
                pageNumber++;
            }

            log.info("Synced {} templates from WATI for institute {}", synced, instituteId);
            return synced;

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("WATI sync failed: " + e.getMessage());
        }
    }

    private void syncSingleWatiTemplate(String instituteId, JsonNode tmpl) {
        String name = tmpl.path("elementName").asText(tmpl.path("name").asText(""));
        String language = tmpl.path("languageCode").asText(tmpl.path("language").asText("en"));
        String status = tmpl.path("status").asText("APPROVED").toUpperCase();
        String category = tmpl.path("category").asText("");
        String rejectedReason = tmpl.path("rejectedReason").asText(null);

                // Parse body
                String bodyText = tmpl.path("body").asText(tmpl.path("bodyOriginal").asText(""));

                // Parse header
                String headerType = "NONE";
                String headerText = null;
                JsonNode headerNode = tmpl.path("header");
                if (!headerNode.isMissingNode() && headerNode.isObject()) {
                    String format = headerNode.path("format").asText(
                            headerNode.path("type").asText("TEXT")).toUpperCase();
                    headerType = format;
                    if ("TEXT".equals(format)) {
                        headerText = headerNode.path("text").asText(null);
                    }
                }

                // Parse footer
                String footerText = null;
                JsonNode footerNode = tmpl.path("footer");
                if (!footerNode.isMissingNode()) {
                    if (footerNode.isTextual()) {
                        footerText = footerNode.asText(null);
                    } else if (footerNode.isObject()) {
                        footerText = footerNode.path("text").asText(null);
                    }
                }

                // Parse buttons
                List<WhatsAppTemplateDTO.TemplateButton> buttons = new ArrayList<>();
                JsonNode buttonsNode = tmpl.path("buttons");
                if (buttonsNode.isArray()) {
                    for (JsonNode btn : buttonsNode) {
                        buttons.add(WhatsAppTemplateDTO.TemplateButton.builder()
                                .type(btn.path("type").asText(""))
                                .text(btn.path("text").asText(""))
                                .url(btn.path("url").asText(null))
                                .phoneNumber(btn.path("phone_number").asText(null))
                                .build());
                    }
                }

                // Upsert: find existing or create new
                Optional<WhatsAppTemplate> existingOpt = templateRepository
                        .findByInstituteIdAndNameAndLanguage(instituteId, name, language);

                WhatsAppTemplate template;
                if (existingOpt.isPresent()) {
                    template = existingOpt.get();
                    template.setStatus(status);
                    template.setCategory(category);
                    template.setRejectionReason(rejectedReason);
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
    }

    private WatiCredentials resolveWatiCredentials(String instituteId) {
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

            JsonNode wati = ws.path("wati");
            String apiKey = wati.path("apiKey").asText(wati.path("api_key").asText(""));
            String apiUrl = wati.path("apiUrl").asText(wati.path("api_url").asText("https://live-server.wati.io"));

            if (apiKey.isBlank()) return null;
            return new WatiCredentials(apiKey, apiUrl);
        } catch (Exception e) {
            log.error("Failed to resolve WATI credentials: {}", e.getMessage());
            return null;
        }
    }

    // ==================== Helpers ====================

    /**
     * Upload sample header media to Meta via the Resumable Upload API and
     * return the resulting handle for use as `example.header_handle` when
     * submitting an IMAGE/VIDEO/DOCUMENT-header template.
     *
     * Two-step flow per
     * https://developers.facebook.com/docs/graph-api/guides/upload :
     *   1) POST /v22.0/{app_id}/uploads?file_name=&file_length=&file_type=
     *      with Bearer auth → returns {"id": "upload:..."}
     *   2) POST /v22.0/{upload_session_id} with Authorization: OAuth <token>
     *      (NOT Bearer), header file_offset: 0, body = raw bytes
     *      → returns {"h": "<handle>"}
     */
    private String uploadHeaderMediaToMeta(String mediaUrl, MetaCredentials creds, String headerType) {
        // Step 0: download the bytes from the public sample URL.
        byte[] bytes;
        String contentType;
        try {
            ResponseEntity<byte[]> downloadResp = restTemplate.exchange(
                    mediaUrl, HttpMethod.GET, HttpEntity.EMPTY, byte[].class);
            bytes = downloadResp.getBody();
            if (bytes == null || bytes.length == 0) {
                throw new RuntimeException("Sample media URL returned empty body: " + mediaUrl);
            }
            contentType = downloadResp.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE);
        } catch (org.springframework.web.client.RestClientException e) {
            throw new RuntimeException("Failed to download sample media from " + mediaUrl
                    + " — make sure the URL is publicly accessible. Cause: " + e.getMessage(), e);
        }
        if (contentType == null || contentType.isBlank()) {
            contentType = guessContentTypeFromUrl(mediaUrl, headerType);
        }
        // Strip parameters like "; charset=..." that some CDNs return.
        int semi = contentType.indexOf(';');
        if (semi > 0) contentType = contentType.substring(0, semi).trim();

        String fileName = extractFileName(mediaUrl, headerType);

        // Step 1: start an upload session. Per Meta docs, both Bearer and the
        // access_token query param work — we use Bearer to match the rest of
        // this service's calls.
        //
        // IMPORTANT: do NOT URL-encode the `file_type` value. Meta validates it
        // against the regex /^[a-z]+(\/[A-Za-z.0-9-+]+)?$/ which requires a
        // literal '/'. URLEncoder.encode turns "image/png" into "image%2Fpng"
        // and Meta rejects it with error code 100.
        String startUrl = "https://graph.facebook.com/v22.0/" + creds.appId + "/uploads"
                + "?file_name=" + URLEncoder.encode(fileName, StandardCharsets.UTF_8)
                + "&file_length=" + bytes.length
                + "&file_type=" + contentType;

        HttpHeaders startHeaders = new HttpHeaders();
        startHeaders.setBearerAuth(creds.accessToken);
        HttpEntity<Void> startRequest = new HttpEntity<>(null, startHeaders);

        String uploadSessionId;
        try {
            ResponseEntity<String> startResp = restTemplate.exchange(
                    startUrl, HttpMethod.POST, startRequest, String.class);
            log.info("Meta resumable-upload start: status={}, body={}",
                    startResp.getStatusCode(), startResp.getBody());
            if (!startResp.getStatusCode().is2xxSuccessful() || startResp.getBody() == null) {
                throw new RuntimeException("Meta resumable-upload start failed (" + startResp.getStatusCode() + "): "
                        + startResp.getBody());
            }
            uploadSessionId = objectMapper.readTree(startResp.getBody()).path("id").asText(null);
            if (uploadSessionId == null || uploadSessionId.isBlank()) {
                throw new RuntimeException("Meta resumable-upload start returned no session id: " + startResp.getBody());
            }
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            // Meta returns the actual error in the response body — surface it.
            throw new RuntimeException("Meta resumable-upload start failed: "
                    + e.getStatusCode() + " " + e.getResponseBodyAsString(), e);
        } catch (org.springframework.web.client.RestClientException e) {
            throw new RuntimeException("Meta resumable-upload start network error: " + e.getMessage(), e);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new RuntimeException("Meta resumable-upload start returned invalid JSON: " + e.getMessage(), e);
        }

        // Step 2: upload the bytes. NOTE: this leg uses "Authorization: OAuth <token>"
        // (the literal scheme name "OAuth", not "Bearer") and a "file_offset" header.
        String uploadUrl = "https://graph.facebook.com/v22.0/" + uploadSessionId;
        HttpHeaders uploadHeaders = new HttpHeaders();
        uploadHeaders.set(HttpHeaders.AUTHORIZATION, "OAuth " + creds.accessToken);
        uploadHeaders.set("file_offset", "0");
        uploadHeaders.setContentType(MediaType.parseMediaType(contentType));
        HttpEntity<byte[]> uploadRequest = new HttpEntity<>(bytes, uploadHeaders);

        try {
            ResponseEntity<String> uploadResp = restTemplate.exchange(
                    uploadUrl, HttpMethod.POST, uploadRequest, String.class);
            log.info("Meta resumable-upload bytes: status={}, body={}",
                    uploadResp.getStatusCode(), uploadResp.getBody());
            if (!uploadResp.getStatusCode().is2xxSuccessful() || uploadResp.getBody() == null) {
                throw new RuntimeException("Meta resumable-upload bytes failed (" + uploadResp.getStatusCode() + "): "
                        + uploadResp.getBody());
            }
            String handle = objectMapper.readTree(uploadResp.getBody()).path("h").asText(null);
            if (handle == null || handle.isBlank()) {
                throw new RuntimeException("Meta resumable-upload returned no handle: " + uploadResp.getBody());
            }
            log.info("Meta resumable-upload succeeded: bytes={}, sessionId={}", bytes.length, uploadSessionId);
            return handle;
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            throw new RuntimeException("Meta resumable-upload bytes failed: "
                    + e.getStatusCode() + " " + e.getResponseBodyAsString(), e);
        } catch (org.springframework.web.client.RestClientException e) {
            throw new RuntimeException("Meta resumable-upload bytes network error: " + e.getMessage(), e);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new RuntimeException("Meta resumable-upload bytes returned invalid JSON: " + e.getMessage(), e);
        }
    }

    private String extractFileName(String url, String headerType) {
        try {
            String path = url.split("\\?", 2)[0];
            int slash = path.lastIndexOf('/');
            String name = slash >= 0 ? path.substring(slash + 1) : path;
            if (!name.isBlank()) return name;
        } catch (Exception ignored) {
            // fall through to default
        }
        return "sample-" + headerType.toLowerCase();
    }

    private String guessContentTypeFromUrl(String url, String headerType) {
        String lower = url.toLowerCase().split("\\?", 2)[0];
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".mp4")) return "video/mp4";
        if (lower.endsWith(".3gp")) return "video/3gpp";
        if (lower.endsWith(".pdf")) return "application/pdf";
        // Sensible defaults per header type
        return switch (headerType) {
            case "IMAGE" -> "image/jpeg";
            case "VIDEO" -> "video/mp4";
            case "DOCUMENT" -> "application/pdf";
            default -> "application/octet-stream";
        };
    }

    private Map<String, Object> buildMetaTemplatePayload(WhatsAppTemplate template, String headerHandle) {
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
                // Media headers require a handle obtained via Meta's Resumable
                // Upload API (passed in by the caller). A raw URL is rejected
                // by Meta with subcode 2388273.
                if (headerHandle != null && !headerHandle.isBlank()) {
                    header.put("example", Map.of("header_handle", List.of(headerHandle)));
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
            // app_id is required for the Resumable Upload API used to obtain a
            // header_handle when submitting templates with IMAGE/VIDEO/DOCUMENT
            // headers. Same key as ChannelMappingController reads for webhook
            // subscription. Optional: if missing, media-header submit will fail
            // with a clearer error than Meta's subcode 2388273.
            String appId = meta.path("app_id").asText(meta.path("appId").asText(""));

            if (accessToken.isBlank() || wabaId.isBlank()) return null;
            return new MetaCredentials(accessToken, wabaId, appId);
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
                .bodyVariableNames(fromJsonList(t.getBodyVariableNames()))
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

    private record MetaCredentials(String accessToken, String wabaId, String appId) {}
    private record WatiCredentials(String apiKey, String apiUrl) {}
}
