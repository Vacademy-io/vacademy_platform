package vacademy.io.admin_core_service.features.audience.strategy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.dto.NormalizedLeadData;
import vacademy.io.admin_core_service.features.audience.dto.OAuthTokenResult;
import vacademy.io.admin_core_service.features.audience.dto.PlatformFormField;
import vacademy.io.admin_core_service.features.audience.dto.WebhookSubscriptionResult;
import vacademy.io.admin_core_service.features.audience.entity.FormWebhookConnector;

import java.util.*;

/**
 * Ad platform strategy for Google Lead Form Extensions.
 *
 * Authentication: no OAuth. Instead, each connector has a static {@code vendor_id}
 * (the google_key) that is embedded in the webhook URL:
 *   POST /admin-core-service/api/v1/webhook/google/{googleKey}
 *
 * Google Ads sends the full lead payload in one POST, so no secondary API call needed.
 *
 * Payload format (Google Lead Form Extensions webhook):
 * {
 *   "google_key": "...",
 *   "lead_id": "...",
 *   "campaign_id": "...",
 *   "adgroup_id": "...",
 *   "creative_id": "...",
 *   "api_version": "1.0",
 *   "user_column_data": [
 *     {"column_id": "FULL_NAME", "string_value": "John Doe"},
 *     {"column_id": "EMAIL",     "string_value": "john@example.com"},
 *     {"column_id": "PHONE_NUMBER", "string_value": "+91..."},
 *     {"column_id": "CUSTOM_QUESTION_a1b2", "string_value": "Math"}
 *   ],
 *   "is_test": false
 * }
 *
 * Setup instructions for admins:
 * 1. In Google Ads, go to Lead Form Extensions → Webhook integration
 * 2. Webhook URL: https://api.vacademy.io/admin-core-service/api/v1/webhook/google/{googleKey}
 * 3. Key: paste the same googleKey value
 * 4. Send test lead to verify
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleLeadFormStrategy implements AdPlatformStrategy {

    private static final String VENDOR_CODE = "GOOGLE_LEAD_ADS";

    private final ObjectMapper objectMapper;

    @Override
    public String getVendorCode() {
        return VENDOR_CODE;
    }

    // ── Webhook verification ─────────────────────────────────────────────────

    @Override
    public boolean verifyWebhookSignature(String signatureHeader, String rawBody) {
        // Google Lead Form Extensions have no payload signature.
        // Authentication is by URL path (googleKey), verified before this is called.
        return true;
    }

    @Override
    public Optional<String> handleVerificationChallenge(Map<String, String> queryParams,
            String verifyToken) {
        // Google Lead Forms don't use a hub-challenge pattern. No GET verification needed.
        return Optional.empty();
    }

    // ── Lead extraction ──────────────────────────────────────────────────────

    @Override
    public List<NormalizedLeadData> extractAndFetchLeads(String rawBody,
            FormWebhookConnector connector) {
        try {
            JsonNode root = objectMapper.readTree(rawBody);

            boolean isTest = root.path("is_test").asBoolean(false);
            String leadId = root.path("lead_id").asText(null);

            // Parse user_column_data into a flat map
            Map<String, String> rawFields = new LinkedHashMap<>();
            for (JsonNode col : root.path("user_column_data")) {
                String columnId = col.path("column_id").asText(null);
                String value = col.path("string_value").asText(null);
                if (columnId != null && value != null) {
                    // Normalize Google standard column IDs to common keys
                    rawFields.put(normalizeGoogleKey(columnId), value);
                }
            }

            // Also add campaign context fields
            String campaignId = root.path("campaign_id").asText(null);
            if (campaignId != null) rawFields.put("campaign_id", campaignId);

            // Extract standard fields from raw (before mapping changes keys)
            String rawEmail = rawFields.get("email");
            String rawPhone = rawFields.get("phone_number");
            String rawName = rawFields.get("full_name");

            // Apply field mapping from connector config
            Map<String, String> mappedFields = applyFieldMapping(rawFields, connector.getFieldMappingJson());

            NormalizedLeadData lead = NormalizedLeadData.builder()
                    .platformLeadId(leadId)
                    .fields(mappedFields)
                    .email(rawEmail)
                    .phone(rawPhone)
                    .fullName(rawName)
                    .sourceType("GOOGLE_ADS")
                    .targetAudienceId(connector.getAudienceId())
                    .testLead(isTest)
                    .build();

            return List.of(lead);
        } catch (Exception e) {
            log.error("Failed to parse Google lead webhook payload", e);
            return List.of();
        }
    }

    // ── OAuth flow — not applicable for Google Lead Forms ────────────────────

    @Override
    public String buildOAuthUrl(String stateToken, String redirectUri) {
        throw new UnsupportedOperationException(
                "Google Lead Form Extensions use a static key, not OAuth");
    }

    @Override
    public OAuthTokenResult exchangeCodeForToken(String code, String redirectUri) {
        throw new UnsupportedOperationException(
                "Google Lead Form Extensions use a static key, not OAuth");
    }

    @Override
    public List<Map<String, String>> listConnectableAccounts(String accessToken) {
        return List.of();
    }

    @Override
    public List<PlatformFormField> fetchFormFields(String formId, String accessToken) {
        // Google Lead Form field definitions are not queryable via API;
        // admins configure field mapping manually from the form preview.
        return List.of(
                PlatformFormField.builder().key("FULL_NAME").label("Full Name").type("TEXT").standardField(true).build(),
                PlatformFormField.builder().key("EMAIL").label("Email").type("EMAIL").standardField(true).build(),
                PlatformFormField.builder().key("PHONE_NUMBER").label("Phone Number").type("PHONE").standardField(true).build(),
                PlatformFormField.builder().key("POSTAL_CODE").label("Postal Code").type("TEXT").standardField(true).build(),
                PlatformFormField.builder().key("CITY").label("City").type("TEXT").standardField(true).build()
        );
    }

    @Override
    public WebhookSubscriptionResult subscribePageToWebhooks(FormWebhookConnector connector, String decryptedToken) {
        // No subscription step for Google — webhook URL is pasted directly in Google Ads UI
        log.info("Google Lead Forms connector {} configured. Webhook URL must be set in Google Ads UI.", connector.getId());
        return WebhookSubscriptionResult.ok();
    }

    @Override
    public Optional<OAuthTokenResult> refreshToken(FormWebhookConnector connector,
            String decryptedCurrentToken) {
        // Static keys don't expire
        return Optional.empty();
    }

    // ── Field mapping ────────────────────────────────────────────────────────

    /**
     * Normalize Google's upper-case column IDs to lowercase common keys.
     * FULL_NAME → full_name, EMAIL → email, PHONE_NUMBER → phone_number, etc.
     * Custom questions are left as-is (already lowercase in Google's payload).
     */
    private String normalizeGoogleKey(String columnId) {
        return switch (columnId) {
            case "FULL_NAME" -> "full_name";
            case "EMAIL" -> "email";
            case "PHONE_NUMBER" -> "phone_number";
            case "POSTAL_CODE" -> "postal_code";
            case "CITY" -> "city";
            case "COUNTRY" -> "country";
            case "COMPANY_NAME" -> "company_name";
            case "JOB_TITLE" -> "job_title";
            default -> columnId.toLowerCase();
        };
    }

    private Map<String, String> applyFieldMapping(Map<String, String> rawFields,
            String fieldMappingJson) {
        if (fieldMappingJson == null || fieldMappingJson.isBlank()) return rawFields;

        try {
            JsonNode mappingRoot = objectMapper.readTree(fieldMappingJson);
            JsonNode mappings = mappingRoot.path("mappings");
            Map<String, String> result = new LinkedHashMap<>();

            for (JsonNode mapping : mappings) {
                String platformKey = mapping.path("platform_key").asText(null);
                String target = mapping.path("target").asText(null);
                if (platformKey == null || target == null) continue;

                String value = rawFields.get(platformKey);
                if (value == null) continue;

                if (target.startsWith("STANDARD:")) {
                    result.put(target.substring("STANDARD:".length()), value);
                } else if (target.startsWith("CUSTOM:")) {
                    result.put(target.substring("CUSTOM:".length()), value);
                } else {
                    result.put(target, value);
                }
            }

            String action = mappingRoot.path("unmapped_field_action").asText("DISCARD");
            if (!"DISCARD".equals(action)) {
                for (Map.Entry<String, String> e : rawFields.entrySet()) {
                    result.putIfAbsent(e.getKey(), e.getValue());
                }
            }
            return result;
        } catch (Exception e) {
            log.error("Failed to apply field mapping, using raw fields", e);
            return rawFields;
        }
    }
}
