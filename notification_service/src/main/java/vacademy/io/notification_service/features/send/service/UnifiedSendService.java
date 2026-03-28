package vacademy.io.notification_service.features.send.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.chatbot_flow.entity.NotificationTemplate;
import vacademy.io.notification_service.features.chatbot_flow.repository.NotificationTemplateRepository;
import vacademy.io.notification_service.features.firebase_notifications.service.PushNotificationService;
import vacademy.io.notification_service.features.send.dto.SendBatchSummaryDTO;
import vacademy.io.notification_service.features.send.dto.UnifiedSendRequest;
import vacademy.io.notification_service.features.send.dto.UnifiedSendResponse;
import vacademy.io.notification_service.features.send.entity.SendBatch;
import vacademy.io.notification_service.features.send.repository.SendBatchRepository;
import vacademy.io.notification_service.service.EmailService;
import vacademy.io.notification_service.service.WhatsAppService;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UnifiedSendService implements SendChannelRouter {

    private final WhatsAppService whatsAppService;
    private final EmailService emailService;
    private final PushNotificationService pushNotificationService;
    private final SendBatchRepository sendBatchRepository;
    private final ObjectMapper objectMapper;
    private final BatchProcessorService batchProcessorService;
    private final NotificationTemplateRepository notificationTemplateRepository;

    private static final int SYNC_THRESHOLD = 100;

    @PostConstruct
    public void init() {
        // Wire ourselves into BatchProcessorService to break circular dependency
        batchProcessorService.setChannelRouter(this);
    }

    /**
     * Main entry point. Routes by channel, decides sync vs async based on recipient count.
     */
    public UnifiedSendResponse send(UnifiedSendRequest request) {
        validateRequest(request);

        int recipientCount = request.getRecipients().size();

        if (recipientCount <= SYNC_THRESHOLD) {
            return routeSync(request);
        }

        return queueForAsync(request);
    }

    @Override
    public UnifiedSendResponse routeSync(UnifiedSendRequest request) {
        String channel = request.getChannel().toUpperCase();

        switch (channel) {
            case "WHATSAPP":
                return sendWhatsApp(request);
            case "EMAIL":
                return sendEmail(request);
            case "PUSH":
                return sendPush(request);
            case "SYSTEM_ALERT":
                return sendSystemAlert(request);
            default:
                throw new IllegalArgumentException("Unsupported channel: " + channel);
        }
    }

    // ==================== WhatsApp ====================

    private UnifiedSendResponse sendWhatsApp(UnifiedSendRequest request) {
        List<UnifiedSendResponse.RecipientResult> results = new ArrayList<>();

        // Phase 3: Resolve named variables → positional using stored template
        Map<String, Integer> nameToPosition = resolveTemplateVariablePositions(
                request.getInstituteId(), request.getTemplateName(),
                request.getLanguageCode() != null ? request.getLanguageCode() : "en");

        List<Map<String, Map<String, String>>> bodyParams = new ArrayList<>();
        Map<String, Map<String, String>> headerParams = new HashMap<>();
        Map<String, String> headerVideoParams = new HashMap<>();
        Map<String, String> buttonUrlParams = new HashMap<>();

        for (UnifiedSendRequest.Recipient r : request.getRecipients()) {
            String phone = sanitizePhone(r.getPhone());
            if (phone == null || phone.isEmpty()) {
                results.add(UnifiedSendResponse.RecipientResult.builder()
                        .phone(r.getPhone()).success(false)
                        .status("FAILED").error("Missing phone number").build());
                continue;
            }

            Map<String, String> vars = r.getVariables() != null ? r.getVariables() : Map.of();

            // Convert named vars to positional if we have the template mapping
            Map<String, String> resolvedVars;
            if (!nameToPosition.isEmpty()) {
                resolvedVars = new HashMap<>();
                for (Map.Entry<String, String> entry : vars.entrySet()) {
                    Integer pos = nameToPosition.get(entry.getKey());
                    if (pos != null) {
                        resolvedVars.put(String.valueOf(pos), entry.getValue());
                    } else {
                        // Keep as-is if no mapping found (might be positional already)
                        resolvedVars.put(entry.getKey(), entry.getValue());
                    }
                }
            } else {
                resolvedVars = vars;
            }

            Map<String, Map<String, String>> userMap = new HashMap<>();
            userMap.put(phone, resolvedVars);
            bodyParams.add(userMap);

            // Header params (image/document) — from global options or per-recipient variable
            String headerUrl = null;
            if (r.getVariables() != null && r.getVariables().containsKey("_headerUrl")) {
                headerUrl = r.getVariables().get("_headerUrl");
            } else if (request.getOptions() != null && request.getOptions().getHeaderUrl() != null) {
                headerUrl = request.getOptions().getHeaderUrl();
            }

            if (headerUrl != null) {
                String hType = request.getOptions() != null ? request.getOptions().getHeaderType() : null;
                if ("video".equalsIgnoreCase(hType)) {
                    headerVideoParams.put(phone, headerUrl);
                } else {
                    headerParams.put(phone, Map.of("link", headerUrl));
                }
            }

            // Fix #2: Per-recipient button URL params from variables
            String btnUrl = null;
            if (r.getVariables() != null && r.getVariables().containsKey("_buttonUrl")) {
                btnUrl = r.getVariables().get("_buttonUrl");
            } else if (request.getOptions() != null && request.getOptions().getButtonUrlParams() != null) {
                btnUrl = request.getOptions().getButtonUrlParams().values().stream()
                        .findFirst().orElse(null);
            }
            if (btnUrl != null) {
                buttonUrlParams.put(phone, btnUrl);
            }
        }

        if (bodyParams.isEmpty()) {
            return UnifiedSendResponse.builder()
                    .total(request.getRecipients().size())
                    .accepted(0).failed(results.size())
                    .status("COMPLETED").results(results).build();
        }

        try {
            String headerType = request.getOptions() != null ? request.getOptions().getHeaderType() : null;
            String langCode = request.getLanguageCode() != null ? request.getLanguageCode() : "en";

            List<Map<String, Boolean>> waResults = whatsAppService.sendWhatsappMessagesExtended(
                    request.getTemplateName(),
                    bodyParams,
                    headerParams.isEmpty() ? null : headerParams,
                    headerVideoParams.isEmpty() ? null : headerVideoParams,
                    buttonUrlParams.isEmpty() ? null : buttonUrlParams,
                    null,
                    langCode,
                    headerType,
                    request.getInstituteId());

            if (waResults != null) {
                for (Map<String, Boolean> resultMap : waResults) {
                    for (Map.Entry<String, Boolean> entry : resultMap.entrySet()) {
                        results.add(UnifiedSendResponse.RecipientResult.builder()
                                .phone(entry.getKey())
                                .success(Boolean.TRUE.equals(entry.getValue()))
                                .status(Boolean.TRUE.equals(entry.getValue()) ? "SENT" : "FAILED")
                                .build());
                    }
                }
            }
        } catch (Exception e) {
            log.error("WhatsApp send failed for institute {}: {}", request.getInstituteId(), e.getMessage(), e);
            for (Map<String, Map<String, String>> userMap : bodyParams) {
                for (String phone : userMap.keySet()) {
                    results.add(UnifiedSendResponse.RecipientResult.builder()
                            .phone(phone).success(false)
                            .status("FAILED").error(e.getMessage()).build());
                }
            }
        }

        int sent = (int) results.stream().filter(UnifiedSendResponse.RecipientResult::isSuccess).count();
        int failed = results.size() - sent;

        return UnifiedSendResponse.builder()
                .total(results.size()).accepted(sent).failed(failed)
                .status(failed == 0 ? "COMPLETED" : "PARTIAL")
                .results(results).build();
    }

    // ==================== Email ====================

    private UnifiedSendResponse sendEmail(UnifiedSendRequest request) {
        List<UnifiedSendResponse.RecipientResult> results = new ArrayList<>();
        UnifiedSendRequest.SendOptions opts = request.getOptions() != null
                ? request.getOptions()
                : UnifiedSendRequest.SendOptions.builder().build();

        // Resolve email template if templateName is provided (look up from notification_template)
        String templateSubject = opts.getEmailSubject();
        String templateBody = opts.getEmailBody();

        if (request.getTemplateName() != null && !request.getTemplateName().isEmpty()) {
            try {
                Optional<NotificationTemplate> templateOpt = notificationTemplateRepository
                        .findByInstituteIdAndNameAndChannelType(
                                request.getInstituteId(), request.getTemplateName(), "EMAIL");
                if (templateOpt.isPresent()) {
                    NotificationTemplate tmpl = templateOpt.get();
                    if (tmpl.getSubject() != null) templateSubject = tmpl.getSubject();
                    if (tmpl.getContent() != null) templateBody = tmpl.getContent();
                    log.debug("Resolved email template '{}' for institute {}",
                            request.getTemplateName(), request.getInstituteId());
                } else {
                    log.warn("Email template '{}' not found for institute {}, using options",
                            request.getTemplateName(), request.getInstituteId());
                }
            } catch (Exception e) {
                log.warn("Failed to resolve email template '{}': {}", request.getTemplateName(), e.getMessage());
            }
        }

        // Optional rate limiting for bulk sends (e.g., announcements)
        com.google.common.util.concurrent.RateLimiter rateLimiter = null;
        if (opts.getRateLimitPerSecond() != null && opts.getRateLimitPerSecond() > 0) {
            rateLimiter = com.google.common.util.concurrent.RateLimiter.create(opts.getRateLimitPerSecond());
            log.info("Email rate limiting enabled: {} emails/sec", opts.getRateLimitPerSecond());
        }

        for (UnifiedSendRequest.Recipient r : request.getRecipients()) {
            String email = r.getEmail();
            if (email == null || email.isEmpty()) {
                results.add(UnifiedSendResponse.RecipientResult.builder()
                        .email(email).success(false)
                        .status("FAILED").error("Missing email").build());
                continue;
            }

            // Rate limit if configured
            if (rateLimiter != null) {
                rateLimiter.acquire();
            }

            try {
                String subject = templateSubject != null ? templateSubject : "Notification";
                String body = templateBody != null ? templateBody : "";

                if (r.getVariables() != null) {
                    for (Map.Entry<String, String> var : r.getVariables().entrySet()) {
                        String placeholder = "{{" + var.getKey() + "}}";
                        String value = var.getValue() != null ? var.getValue() : "";
                        subject = subject.replace(placeholder, value);
                        body = body.replace(placeholder, value);
                    }
                }

                String emailType = opts.getEmailType() != null ? opts.getEmailType() : "UTILITY_EMAIL";

                // Check for attachments
                if (r.getAttachments() != null && !r.getAttachments().isEmpty()) {
                    Map<String, byte[]> attachmentMap = new HashMap<>();
                    for (UnifiedSendRequest.Attachment att : r.getAttachments()) {
                        if (att.getFilename() != null && att.getContentBase64() != null) {
                            attachmentMap.put(att.getFilename(),
                                    java.util.Base64.getDecoder().decode(att.getContentBase64()));
                        }
                    }
                    emailService.sendAttachmentEmail(email, subject, "unified-send", body,
                            attachmentMap, request.getInstituteId(), emailType);
                } else {
                    emailService.sendHtmlEmail(email, subject, "unified-send", body,
                            request.getInstituteId(), opts.getFromEmail(), opts.getFromName(), emailType);
                }

                results.add(UnifiedSendResponse.RecipientResult.builder()
                        .email(email).success(true).status("SENT").build());
            } catch (Exception e) {
                String errorMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";

                // Retry-friendly: detect SES throttling errors
                if (errorMsg.contains("Throttling") || errorMsg.contains("Rate") || errorMsg.contains("limit")) {
                    log.warn("Email rate limit hit for {}: {} — marking as QUEUED for retry", email, errorMsg);
                    results.add(UnifiedSendResponse.RecipientResult.builder()
                            .email(email).success(false)
                            .status("QUEUED").error("Rate limited - retry later").build());
                } else {
                    log.error("Email send failed for {}: {}", email, errorMsg);
                    results.add(UnifiedSendResponse.RecipientResult.builder()
                            .email(email).success(false)
                            .status("FAILED").error(errorMsg).build());
                }
            }
        }

        int sent = (int) results.stream().filter(UnifiedSendResponse.RecipientResult::isSuccess).count();
        return UnifiedSendResponse.builder()
                .total(results.size()).accepted(sent).failed(results.size() - sent)
                .status(sent == results.size() ? "COMPLETED" : "PARTIAL")
                .results(results).build();
    }

    // ==================== Push Notification (wired) ====================

    private UnifiedSendResponse sendPush(UnifiedSendRequest request) {
        List<String> userIds = request.getRecipients().stream()
                .map(UnifiedSendRequest.Recipient::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        if (userIds.isEmpty()) {
            return UnifiedSendResponse.builder()
                    .total(0).accepted(0).failed(0)
                    .status("COMPLETED").results(List.of()).build();
        }

        UnifiedSendRequest.SendOptions opts = request.getOptions() != null
                ? request.getOptions()
                : UnifiedSendRequest.SendOptions.builder().build();

        String title = opts.getPushTitle() != null ? opts.getPushTitle() : "Notification";
        String body = opts.getPushBody() != null ? opts.getPushBody() : "";
        Map<String, String> data = opts.getPushData() != null ? opts.getPushData() : Map.of();

        try {
            pushNotificationService.sendNotificationToUsers(
                    request.getInstituteId(), userIds, title, body, data);

            return UnifiedSendResponse.builder()
                    .total(userIds.size()).accepted(userIds.size()).failed(0)
                    .status("COMPLETED").build();
        } catch (Exception e) {
            log.error("Push notification failed for institute {}: {}",
                    request.getInstituteId(), e.getMessage(), e);
            return UnifiedSendResponse.builder()
                    .total(userIds.size()).accepted(0).failed(userIds.size())
                    .status("FAILED").build();
        }
    }

    // ==================== System Alert (wired) ====================

    private UnifiedSendResponse sendSystemAlert(UnifiedSendRequest request) {
        UnifiedSendRequest.SendOptions opts = request.getOptions() != null
                ? request.getOptions()
                : UnifiedSendRequest.SendOptions.builder().build();

        String title = opts.getPushTitle() != null ? opts.getPushTitle() : "Alert";
        String body = opts.getPushBody() != null ? opts.getPushBody() : "";

        // System alerts use push infrastructure with SYSTEM_ALERT data flag
        List<String> userIds = request.getRecipients().stream()
                .map(UnifiedSendRequest.Recipient::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        if (userIds.isEmpty()) {
            return UnifiedSendResponse.builder()
                    .total(0).accepted(0).failed(0)
                    .status("COMPLETED").results(List.of()).build();
        }

        try {
            Map<String, String> alertData = new HashMap<>(
                    opts.getPushData() != null ? opts.getPushData() : Map.of());
            alertData.put("type", "SYSTEM_ALERT");

            pushNotificationService.sendNotificationToUsers(
                    request.getInstituteId(), userIds, title, body, alertData);

            return UnifiedSendResponse.builder()
                    .total(userIds.size()).accepted(userIds.size()).failed(0)
                    .status("COMPLETED").build();
        } catch (Exception e) {
            log.error("System alert failed for institute {}: {}",
                    request.getInstituteId(), e.getMessage(), e);
            return UnifiedSendResponse.builder()
                    .total(userIds.size()).accepted(0).failed(userIds.size())
                    .status("FAILED").build();
        }
    }

    // ==================== Async Batch (delegates to BatchProcessorService) ====================

    private UnifiedSendResponse queueForAsync(UnifiedSendRequest request) {
        String batchId = UUID.randomUUID().toString();

        try {
            SendBatch batch = SendBatch.builder()
                    .id(batchId)
                    .instituteId(request.getInstituteId())
                    .channel(request.getChannel().toUpperCase())
                    .templateName(request.getTemplateName())
                    .totalRecipients(request.getRecipients().size())
                    .sentCount(0).failedCount(0)
                    .status("QUEUED")
                    .requestPayload(objectMapper.writeValueAsString(request))
                    .source(request.getOptions() != null ? request.getOptions().getSource() : null)
                    .build();

            sendBatchRepository.save(batch);

            // Async via separate bean — Spring proxy works correctly
            batchProcessorService.processAsyncBatch(batchId);

            return UnifiedSendResponse.builder()
                    .batchId(batchId)
                    .total(request.getRecipients().size())
                    .accepted(request.getRecipients().size())
                    .failed(0)
                    .status("PROCESSING")
                    .build();

        } catch (Exception e) {
            log.error("Failed to queue batch: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to queue batch: " + e.getMessage());
        }
    }

    public UnifiedSendResponse getBatchStatus(String batchId) {
        SendBatch batch = sendBatchRepository.findById(batchId)
                .orElseThrow(() -> new RuntimeException("Batch not found: " + batchId));

        return UnifiedSendResponse.builder()
                .batchId(batch.getId())
                .total(batch.getTotalRecipients())
                .accepted(batch.getSentCount())
                .failed(batch.getFailedCount())
                .status(batch.getStatus())
                .build();
    }

    public List<SendBatchSummaryDTO> listBatches(String instituteId, int limit) {
        return sendBatchRepository.findByInstituteIdOrderByCreatedAtDesc(instituteId).stream()
                .limit(limit)
                .map(b -> SendBatchSummaryDTO.builder()
                        .id(b.getId())
                        .channel(b.getChannel())
                        .templateName(b.getTemplateName())
                        .totalRecipients(b.getTotalRecipients())
                        .sentCount(b.getSentCount())
                        .failedCount(b.getFailedCount())
                        .status(b.getStatus())
                        .source(b.getSource())
                        .createdAt(b.getCreatedAt())
                        .completedAt(b.getCompletedAt())
                        .build())
                .collect(Collectors.toList());
    }

    // ==================== Phase 3: Named → Positional Variable Resolution ====================

    /**
     * Looks up the template in whatsapp_templates table and builds a mapping:
     * variable name → positional index.
     *
     * Example: bodyText = "Hello {{1}}, welcome to {{2}}"
     * bodySampleValues = '["name", "course"]' (JSON array)
     * Result: {"name" → 1, "course" → 2}
     *
     * If template not found or has no sample values, returns empty map
     * and variables pass through as-is (backward compatible).
     */
    private Map<String, Integer> resolveTemplateVariablePositions(
            String instituteId, String templateName, String language) {

        if (templateName == null || instituteId == null) return Map.of();

        try {
            Optional<NotificationTemplate> templateOpt = notificationTemplateRepository
                    .findByInstituteIdAndNameAndLanguage(instituteId, templateName, language);

            if (templateOpt.isEmpty()) return Map.of();

            NotificationTemplate template = templateOpt.get();

            // Prefer bodyVariableNames (semantic: ["name", "course"])
            // Fall back to bodySampleValues (example values: ["Shreyash", "Math 101"])
            String namesJson = template.getBodyVariableNames();
            if (namesJson == null || namesJson.isBlank()) {
                namesJson = template.getBodySampleValues();
            }

            if (namesJson == null || namesJson.isBlank()) {
                return Map.of();
            }

            String[] sampleNames = objectMapper.readValue(namesJson, String[].class);

            Map<String, Integer> mapping = new HashMap<>();
            for (int i = 0; i < sampleNames.length; i++) {
                String cleanName = sampleNames[i].trim().toLowerCase()
                        .replaceAll("[^a-z0-9_]", "_");
                mapping.put(cleanName, i + 1); // WhatsApp is 1-indexed
                // Also map the original name
                mapping.put(sampleNames[i].trim(), i + 1);
            }

            log.debug("Resolved template variable mapping for {}: {}", templateName, mapping);
            return mapping;

        } catch (Exception e) {
            log.warn("Failed to resolve template variables for {}: {}", templateName, e.getMessage());
            return Map.of();
        }
    }

    // ==================== Helpers ====================

    private void validateRequest(UnifiedSendRequest request) {
        if (request.getInstituteId() == null || request.getInstituteId().isEmpty()) {
            throw new IllegalArgumentException("instituteId is required");
        }
        if (request.getChannel() == null || request.getChannel().isEmpty()) {
            throw new IllegalArgumentException("channel is required");
        }
        if (request.getRecipients() == null || request.getRecipients().isEmpty()) {
            throw new IllegalArgumentException("At least one recipient is required");
        }
    }

    private String sanitizePhone(String phone) {
        if (phone == null) return null;
        return phone.replaceAll("[^0-9]", "");
    }
}
