package vacademy.io.admin_core_service.features.audience.strategy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import vacademy.io.admin_core_service.features.audience.dto.NormalizedLeadData;
import vacademy.io.admin_core_service.features.audience.dto.OAuthTokenResult;
import vacademy.io.admin_core_service.features.audience.dto.PlatformFormField;
import vacademy.io.admin_core_service.features.audience.entity.FormWebhookConnector;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.common.exceptions.VacademyException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Ad platform strategy for Meta Lead Ads (Facebook + Instagram).
 *
 * Webhook flow:
 * 1. GET  → hub.challenge verification (handled at controller level using this strategy)
 * 2. POST → verify X-Hub-Signature-256, parse leadgen events, fetch full lead from Graph API
 *
 * OAuth flow:
 * 1. Redirect user to Meta OAuth URL
 * 2. Exchange code for short-lived token
 * 3. Exchange short-lived for long-lived (~60 days) token
 * 4. Fetch user's pages and let them pick which page to subscribe
 * 5. Get Page access token and subscribe page to lead webhooks
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MetaLeadAdsStrategy implements AdPlatformStrategy {

    private static final String VENDOR_CODE = "META_LEAD_ADS";
    private static final String GRAPH_API_BASE = "https://graph.facebook.com/v21.0";
    private static final String META_OAUTH_BASE = "https://www.facebook.com/v21.0/dialog/oauth";
    private static final String META_TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token";
    private static final String HMAC_SHA256 = "HmacSHA256";

    // Permissions needed for Lead Ads
    private static final String OAUTH_SCOPE =
            "pages_show_list,pages_read_engagement,leads_retrieval,pages_manage_metadata";

    @Value("${meta.app.id:}")
    private String appId;

    @Value("${meta.app.secret:}")
    private String appSecret;

    @Value("${meta.oauth.redirect.uri:}")
    private String defaultRedirectUri;

    @Value("${meta.webhook.verify.token:}")
    private String configuredVerifyToken;

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;
    private final TokenEncryptionService tokenEncryptionService;

    @Override
    public String getVendorCode() {
        return VENDOR_CODE;
    }

    // ── Webhook verification ─────────────────────────────────────────────────

    @Override
    public boolean verifyWebhookSignature(String signatureHeader, String rawBody) {
        if (signatureHeader == null || !signatureHeader.startsWith("sha256=")) {
            log.warn("Missing or malformed X-Hub-Signature-256 header");
            return false;
        }
        String receivedSig = signatureHeader.substring("sha256=".length());
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
            byte[] digest = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
            String expected = bytesToHex(digest);
            return expected.equalsIgnoreCase(receivedSig);
        } catch (Exception e) {
            log.error("Meta HMAC-SHA256 verification failed", e);
            return false;
        }
    }

    @Override
    public Optional<String> handleVerificationChallenge(Map<String, String> queryParams,
            String ignoredParam) {
        String mode = queryParams.get("hub.mode");
        String incomingToken = queryParams.get("hub.verify_token");
        String challenge = queryParams.get("hub.challenge");
        // Compare incoming token against the app-configured secret, not against itself
        if ("subscribe".equals(mode)
                && configuredVerifyToken != null
                && !configuredVerifyToken.isBlank()
                && configuredVerifyToken.equals(incomingToken)) {
            return Optional.ofNullable(challenge);
        }
        log.warn("Meta hub.challenge failed: mode={}, tokenMatch={}", mode,
                configuredVerifyToken != null && configuredVerifyToken.equals(incomingToken));
        return Optional.empty();
    }

    // ── Lead extraction ──────────────────────────────────────────────────────

    @Override
    public List<NormalizedLeadData> extractAndFetchLeads(String rawBody,
            FormWebhookConnector connector) {
        List<NormalizedLeadData> results = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            // Meta payload structure: {"object":"page","entry":[{"changes":[{"field":"leadgen","value":{...}}]}]}
            JsonNode entry = root.path("entry");
            for (JsonNode e : entry) {
                for (JsonNode change : e.path("changes")) {
                    if (!"leadgen".equals(change.path("field").asText())) continue;
                    JsonNode val = change.path("value");
                    String leadgenId = val.path("leadgen_id").asText(null);
                    String formId = val.path("form_id").asText(null);
                    if (leadgenId == null) continue;
                    try {
                        NormalizedLeadData lead = fetchLeadFromGraph(leadgenId, connector);
                        if (lead != null) results.add(lead);
                    } catch (Exception ex) {
                        log.error("Failed to fetch Meta lead {} from form {}", leadgenId, formId, ex);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse Meta webhook payload", e);
        }
        return results;
    }

    private NormalizedLeadData fetchLeadFromGraph(String leadgenId,
            FormWebhookConnector connector) {
        if (connector.getOauthAccessTokenEnc() == null) {
            log.error("No access token for connector {}", connector.getId());
            return null;
        }
        String pageToken = tokenEncryptionService.decrypt(connector.getOauthAccessTokenEnc());
        String url = GRAPH_API_BASE + "/" + leadgenId + "?access_token=" + pageToken
                + "&fields=field_data,created_time,ad_id,form_id";

        JsonNode leadNode = webClientBuilder.build()
                .get().uri(url)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        if (leadNode == null) return null;

        Map<String, String> fields = new LinkedHashMap<>();
        for (JsonNode fieldData : leadNode.path("field_data")) {
            String name = fieldData.path("name").asText();
            String value = fieldData.path("values").path(0).asText("");
            fields.put(name, value);
        }

        // Extract email/phone/name from raw fields BEFORE mapping transforms the keys.
        // Meta uses uppercase keys (EMAIL, FULL_NAME, PHONE_NUMBER) — do case-insensitive lookup.
        String rawEmail = findValueCaseInsensitive(fields, "email");
        String rawPhone = findValueCaseInsensitive(fields, "phone_number");
        String rawName = findValueCaseInsensitive(fields, "full_name");

        // Apply field mapping from connector (transforms keys for audience custom fields)
        Map<String, String> mappedFields = applyFieldMapping(fields, connector.getFieldMappingJson());

        return NormalizedLeadData.builder()
                .platformLeadId(leadgenId)
                .fields(mappedFields)
                .email(rawEmail)
                .phone(rawPhone)
                .fullName(rawName)
                .sourceType(connector.getProducesSourceType() != null
                        ? connector.getProducesSourceType() : "FACEBOOK_ADS")
                .targetAudienceId(connector.getAudienceId())
                .testLead(false)
                .build();
    }

    // ── OAuth flow ───────────────────────────────────────────────────────────

    @Override
    public String buildOAuthUrl(String stateToken, String redirectUri) {
        String uri = redirectUri != null ? redirectUri : defaultRedirectUri;
        try {
            return META_OAUTH_BASE
                    + "?client_id=" + appId
                    + "&redirect_uri=" + URLEncoder.encode(uri, StandardCharsets.UTF_8)
                    + "&scope=" + URLEncoder.encode(OAUTH_SCOPE, StandardCharsets.UTF_8)
                    + "&state=" + URLEncoder.encode(stateToken, StandardCharsets.UTF_8)
                    + "&response_type=code";
        } catch (Exception e) {
            throw new VacademyException("Failed to build Meta OAuth URL: " + e.getMessage());
        }
    }

    @Override
    public OAuthTokenResult exchangeCodeForToken(String code, String redirectUri) {
        // Step 1: exchange code → short-lived user access token
        String shortLived = exchangeCodeForShortLivedToken(code, redirectUri);

        // Step 2: exchange short-lived → long-lived (~60 days) user access token
        return exchangeForLongLivedToken(shortLived);
    }

    private String exchangeCodeForShortLivedToken(String code, String redirectUri) {
        // POST to keep client_secret and code out of server access logs
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("client_id", appId);
        params.add("client_secret", appSecret);
        params.add("redirect_uri", redirectUri);
        params.add("code", code);

        JsonNode response = webClientBuilder.build()
                .post().uri(META_TOKEN_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(BodyInserters.fromFormData(params))
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        if (response == null || !response.has("access_token")) {
            throw new VacademyException("Failed to obtain Meta short-lived token");
        }
        return response.path("access_token").asText();
    }

    private OAuthTokenResult exchangeForLongLivedToken(String shortLivedToken) {
        // POST to keep client_secret out of server access logs
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "fb_exchange_token");
        params.add("client_id", appId);
        params.add("client_secret", appSecret);
        params.add("fb_exchange_token", shortLivedToken);

        JsonNode response = webClientBuilder.build()
                .post().uri(META_TOKEN_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(BodyInserters.fromFormData(params))
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        if (response == null || !response.has("access_token")) {
            throw new VacademyException("Failed to obtain Meta long-lived token");
        }

        String token = response.path("access_token").asText();
        long expiresInSeconds = response.path("expires_in").asLong(5184000L); // default 60 days
        LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(expiresInSeconds);

        return OAuthTokenResult.builder()
                .accessToken(token)
                .expiresAt(expiresAt)
                .build();
    }

    @Override
    public List<Map<String, String>> listConnectableAccounts(String accessToken) {
        String url = GRAPH_API_BASE + "/me/accounts?access_token=" + accessToken
                + "&fields=id,name,access_token";

        JsonNode response = webClientBuilder.build()
                .get().uri(url)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        List<Map<String, String>> pages = new ArrayList<>();
        if (response == null) return pages;

        for (JsonNode page : response.path("data")) {
            Map<String, String> p = new LinkedHashMap<>();
            p.put("id", page.path("id").asText());
            p.put("name", page.path("name").asText());
            p.put("access_token", page.path("access_token").asText());
            pages.add(p);
        }
        return pages;
    }

    /**
     * List all lead gen forms for a Facebook Page.
     * Returns [{id, name, status}] — no tokens exposed.
     */
    public List<Map<String, String>> listPageForms(String pageId, String pageAccessToken) {
        String url = GRAPH_API_BASE + "/" + pageId + "/leadgen_forms"
                + "?access_token=" + pageAccessToken
                + "&fields=id,name,status";

        JsonNode response = webClientBuilder.build()
                .get().uri(url)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        List<Map<String, String>> forms = new ArrayList<>();
        if (response == null) return forms;

        for (JsonNode form : response.path("data")) {
            Map<String, String> f = new LinkedHashMap<>();
            f.put("id", form.path("id").asText());
            f.put("name", form.path("name").asText("Unnamed Form"));
            f.put("status", form.path("status").asText("ACTIVE"));
            forms.add(f);
        }
        return forms;
    }

    @Override
    public List<PlatformFormField> fetchFormFields(String formId, String accessToken) {
        String url = GRAPH_API_BASE + "/" + formId + "?access_token=" + accessToken
                + "&fields=questions,name";

        JsonNode response = webClientBuilder.build()
                .get().uri(url)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        List<PlatformFormField> fields = new ArrayList<>();
        if (response == null) return fields;

        for (JsonNode q : response.path("questions")) {
            String type = q.path("type").asText("TEXT");
            String key = q.path("key").asText(q.path("label").asText("").toLowerCase().replace(" ", "_"));
            String label = q.path("label").asText(key);
            fields.add(PlatformFormField.builder()
                    .key(key)
                    .label(label)
                    .type(type)
                    .standardField(!"CUSTOM".equals(type))
                    .build());
        }
        return fields;
    }

    @Override
    public void subscribePageToWebhooks(FormWebhookConnector connector, String decryptedToken) {
        // Subscribe the page to leadgen webhook events
        String pageId = connector.getPlatformPageId();
        String url = GRAPH_API_BASE + "/" + pageId + "/subscribed_apps"
                + "?subscribed_fields=leadgen"
                + "&access_token=" + decryptedToken;

        JsonNode response = webClientBuilder.build()
                .post().uri(url)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        if (response == null || !response.path("success").asBoolean()) {
            log.warn("Page subscription may have failed for page {}: {}", pageId, response);
        } else {
            log.info("Successfully subscribed Meta page {} to leadgen webhooks", pageId);
        }
    }

    @Override
    public Optional<OAuthTokenResult> refreshToken(FormWebhookConnector connector,
            String decryptedCurrentToken) {
        // Meta long-lived tokens can be refreshed by exchanging them for new long-lived tokens
        try {
            OAuthTokenResult result = exchangeForLongLivedToken(decryptedCurrentToken);
            return Optional.of(result);
        } catch (Exception e) {
            log.error("Failed to refresh Meta token for connector {}", connector.getId(), e);
            return Optional.empty();
        }
    }

    // ── Field mapping ────────────────────────────────────────────────────────

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

                // Target format: "STANDARD:parent_name" or "CUSTOM:field_key"
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
                // KEEP_ORIGINAL: include unmapped fields with original keys
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

    // ── Utilities ────────────────────────────────────────────────────────────

    /** Case-insensitive lookup in a map (Meta sends EMAIL, FULL_NAME, etc.) */
    private String findValueCaseInsensitive(Map<String, String> map, String key) {
        // Try exact match first
        String v = map.get(key);
        if (v != null) return v;
        // Try case-insensitive
        for (Map.Entry<String, String> e : map.entrySet()) {
            if (e.getKey().equalsIgnoreCase(key)) return e.getValue();
        }
        return null;
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
