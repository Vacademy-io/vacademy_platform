package vacademy.io.admin_core_service.features.audience.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.audience.dto.AdConnectorSetupRequest;
import vacademy.io.admin_core_service.features.audience.dto.ConnectorListItemDTO;
import vacademy.io.admin_core_service.features.audience.dto.MetaPageDTO;
import vacademy.io.admin_core_service.features.audience.dto.OAuthTokenResult;
import vacademy.io.admin_core_service.features.audience.dto.PlatformFormField;
import vacademy.io.admin_core_service.features.audience.entity.FormWebhookConnector;
import vacademy.io.admin_core_service.features.audience.entity.OAuthConnectState;
import vacademy.io.admin_core_service.features.audience.repository.FormWebhookConnectorRepository;
import vacademy.io.admin_core_service.features.audience.repository.OAuthConnectStateRepository;
import vacademy.io.admin_core_service.features.audience.service.AdPlatformWebhookService;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.admin_core_service.features.audience.strategy.MetaLeadAdsStrategy;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Authenticated endpoints for Meta Lead Ads OAuth integration.
 *
 * ── Security model ───────────────────────────────────────────────────────────
 * Access tokens are NEVER returned to the browser. The flow is:
 *
 *   1. POST /initiate
 *        ← Admin frontend calls this (authenticated)
 *        → Server creates oauth_connect_state (PENDING), returns {oauth_url, session_key}
 *        → Frontend redirects the browser tab to oauth_url
 *
 *   2. GET /callback?code=...&state=...
 *        ← Meta redirects the browser here (no JWT — listed as public)
 *        → Server validates state record, exchanges code, fetches pages
 *        → Encrypts user token + per-page tokens, stores in oauth_connect_state (AUTHORIZED)
 *        → Redirects browser to frontend with ?session_key=UUID (no token in URL)
 *
 *   3. GET /session/{sessionKey}/pages
 *        ← Frontend calls this (authenticated) to show the page selector
 *        → Server decrypts pages JSON, returns [{id, name}] — NO tokens
 *
 *   4. GET /forms/{formId}/fields?pageAccessToken=... (kept for pre-connector field inspection)
 *        ← Frontend calls this (authenticated) before saving connector
 *        → Proxies Meta Graph API, returns field list — frontend never stores the token
 *
 *   5. POST /connector
 *        ← Frontend calls with {session_key, selected_page_id, form_id, mapping, ...}
 *        → Server resolves page access token from session, creates connector, marks CONSUMED
 *        → Subscribes page to Meta leadgen webhooks
 *
 *   6. POST /google/connector  (no OAuth — static key flow)
 */
@RestController
@RequestMapping("/admin-core-service/v1/oauth/meta")
@RequiredArgsConstructor
@Slf4j
public class MetaOAuthController {

    private final MetaLeadAdsStrategy metaStrategy;
    private final AdPlatformWebhookService adPlatformWebhookService;
    private final OAuthConnectStateRepository stateRepository;
    private final FormWebhookConnectorRepository connectorRepository;
    private final TokenEncryptionService tokenEncryptionService;
    private final ObjectMapper objectMapper;

    @Value("${meta.oauth.redirect.uri:}")
    private String metaRedirectUri;

    @Value("${meta.webhook.verify.token:}")
    private String metaWebhookVerifyToken;

    @Value("${meta.oauth.frontend.callback.url:}")
    private String frontendCallbackUrl;

    // ── Step 1: Initiate ─────────────────────────────────────────────────────

    /**
     * Creates an OAuth state record and returns the Meta consent URL.
     * The frontend redirects the user (or opens a popup) to oauth_url.
     */
    @PostMapping("/initiate")
    @Transactional
    public ResponseEntity<Map<String, String>> initiateOAuth(
            @RequestParam String instituteId,
            @RequestParam(required = false) String audienceId,
            @RequestParam(required = false) String initiatedBy) {

        OAuthConnectState state = OAuthConnectState.builder()
                .instituteId(instituteId)
                .vendor("META_LEAD_ADS")
                .audienceId(audienceId)
                .initiatedBy(initiatedBy)
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .sessionStatus("PENDING")
                .build();

        OAuthConnectState saved = stateRepository.save(state);
        String oauthUrl = metaStrategy.buildOAuthUrl(saved.getId(), metaRedirectUri);

        log.info("Initiated Meta OAuth for institute={}, state={}", instituteId, saved.getId());
        return ResponseEntity.ok(Map.of(
                "oauth_url", oauthUrl,
                "session_key", saved.getId()
        ));
    }

    // ── Step 2: Callback (browser redirect from Meta — no JWT) ───────────────

    /**
     * Meta redirects the browser here after the admin grants permission.
     * All token handling is server-side. The browser is immediately redirected
     * to the admin frontend with only the session_key as a query parameter.
     */
    @GetMapping("/callback")
    @Transactional
    public ResponseEntity<Void> oauthCallback(
            @RequestParam String code,
            @RequestParam(required = false) String state,
            @RequestParam(value = "error", required = false) String error) {

        // Meta sends error param if user denied access
        if (error != null) {
            log.warn("Meta OAuth denied by user: {}", error);
            return redirectToFrontend("error=" + error, null);
        }

        if (state == null) {
            log.error("Meta OAuth callback received without state param");
            return redirectToFrontend("error=missing_state", null);
        }

        // Validate the state record (prevents CSRF)
        OAuthConnectState stateRecord = stateRepository
                .findValidById(state, LocalDateTime.now())
                .orElse(null);

        if (stateRecord == null) {
            log.error("Meta OAuth callback: state={} not found or expired", state);
            return redirectToFrontend("error=invalid_state", null);
        }

        try {
            // Exchange code → short-lived → long-lived user token (server-side only)
            OAuthTokenResult tokenResult = metaStrategy.exchangeCodeForToken(code, metaRedirectUri);
            String userToken = tokenResult.getAccessToken();

            // Fetch pages the user manages (server-side, token never leaves)
            List<Map<String, String>> rawPages = metaStrategy.listConnectableAccounts(userToken);

            // Encrypt per-page access tokens and build the pages JSON to store
            List<Map<String, String>> pagesForStorage = new ArrayList<>();
            for (Map<String, String> page : rawPages) {
                String pageToken = page.get("access_token");
                if (pageToken == null || pageToken.isBlank()) {
                    log.warn("Skipping page {} — no access_token returned by Meta",
                            page.get("id"));
                    continue;
                }
                Map<String, String> entry = new LinkedHashMap<>();
                entry.put("id", page.get("id"));
                entry.put("name", page.get("name"));
                entry.put("token_enc", tokenEncryptionService.encrypt(pageToken));
                pagesForStorage.add(entry);
            }

            // Encrypt the entire pages JSON blob
            String pagesJson = objectMapper.writeValueAsString(pagesForStorage);
            String pagesJsonEnc = tokenEncryptionService.encrypt(pagesJson);

            // Encrypt user token
            String userTokenEnc = tokenEncryptionService.encrypt(userToken);

            // Update state record: PENDING → AUTHORIZED
            stateRecord.setUserTokenEnc(userTokenEnc);
            stateRecord.setPagesJsonEnc(pagesJsonEnc);
            stateRecord.setSessionStatus("AUTHORIZED");
            // Extend expiry — admin now needs time to configure mapping before saving
            stateRecord.setExpiresAt(LocalDateTime.now().plusMinutes(30));
            stateRepository.save(stateRecord);

            log.info("Meta OAuth authorized for state={}, {} pages found",
                    state, rawPages.size());

            return redirectToFrontend("session_key=" + state, null);

        } catch (Exception e) {
            log.error("Meta OAuth callback processing failed for state={}", state, e);
            stateRecord.setSessionStatus("EXPIRED");
            stateRepository.save(stateRecord);
            return redirectToFrontend("error=server_error", null);
        }
    }

    // ── Step 3: Pages list (safe — no tokens) ────────────────────────────────

    /**
     * Returns the list of Facebook Pages for the admin to pick from.
     * Only id and name are returned — the page access tokens stay server-side.
     */
    @GetMapping("/session/{sessionKey}/pages")
    public ResponseEntity<List<MetaPageDTO>> getSessionPages(
            @PathVariable String sessionKey) {

        OAuthConnectState state = stateRepository
                .findValidById(sessionKey, LocalDateTime.now())
                .orElseThrow(() -> new VacademyException(
                        "Session not found or expired. Please reconnect Meta."));

        if (!"AUTHORIZED".equals(state.getSessionStatus())) {
            throw new VacademyException("OAuth session not yet authorized");
        }

        List<MetaPageDTO> pages = decryptAndListPages(state)
                .stream()
                .map(p -> MetaPageDTO.builder()
                        .id(p.get("id"))
                        .name(p.get("name"))
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(pages);
    }

    // ── Step 4: Form fields ───────────────────────────────────────────────────

    /**
     * Proxy to fetch field definitions for a lead gen form.
     * The session_key is used to look up the page access token server-side —
     * the frontend never holds the token.
     */
    @GetMapping("/session/{sessionKey}/forms/{formId}/fields")
    public ResponseEntity<List<PlatformFormField>> getFormFields(
            @PathVariable String sessionKey,
            @PathVariable String formId,
            @RequestParam String pageId) {

        OAuthConnectState state = stateRepository
                .findValidById(sessionKey, LocalDateTime.now())
                .orElseThrow(() -> new VacademyException("Session not found or expired"));

        String pageToken = resolvePageToken(state, pageId);
        List<PlatformFormField> fields = metaStrategy.fetchFormFields(formId, pageToken);
        return ResponseEntity.ok(fields);
    }

    // ── Step 5: Save connector ────────────────────────────────────────────────

    /**
     * Creates the FormWebhookConnector using the token from the OAuth session.
     * Marks the session as CONSUMED so it cannot be reused.
     */
    @PostMapping("/connector")
    @Transactional
    public ResponseEntity<Map<String, String>> saveConnector(
            @RequestBody AdConnectorSetupRequest request) {

        if (request.getSessionKey() == null || request.getSelectedPageId() == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "sessionKey and selectedPageId are required"));
        }
        if (request.getPlatformFormId() == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "platformFormId is required"));
        }

        OAuthConnectState state = stateRepository
                .findValidById(request.getSessionKey(), LocalDateTime.now())
                .orElseThrow(() -> new VacademyException(
                        "Session not found or expired. Please reconnect Meta."));

        if (!"AUTHORIZED".equals(state.getSessionStatus())) {
            throw new VacademyException("OAuth session is not in AUTHORIZED state");
        }

        // Resolve page name and page access token from session (token stays server-side)
        String pageToken = resolvePageToken(state, request.getSelectedPageId());
        String pageName = resolvePageName(state, request.getSelectedPageId());

        // Determine institute from session if not provided in request
        String instituteId = request.getInstituteId() != null
                ? request.getInstituteId() : state.getInstituteId();
        String audienceId = request.getAudienceId() != null
                ? request.getAudienceId() : state.getAudienceId();

        // Build and save the connector with the encrypted page token
        FormWebhookConnector connector = FormWebhookConnector.builder()
                .vendor("META_LEAD_ADS")
                .vendorId(request.getPlatformFormId())
                .instituteId(instituteId)
                .audienceId(audienceId)
                .platformPageId(request.getSelectedPageId())
                .platformFormId(request.getPlatformFormId())
                .routingRulesJson(request.getRoutingRulesJson())
                .fieldMappingJson(request.getFieldMappingJson())
                .producesSourceType(request.getProducesSourceType() != null
                        ? request.getProducesSourceType() : "FACEBOOK_ADS")
                .connectionStatus("ACTIVE")
                .webhookVerifyToken(metaWebhookVerifyToken)
                .isActive(true)
                .build();

        OAuthTokenResult tokenResult = OAuthTokenResult.builder()
                .accessToken(pageToken)
                .expiresAt(LocalDateTime.now().plusDays(60))
                .build();

        FormWebhookConnector saved = adPlatformWebhookService.saveConnector(connector, tokenResult);

        // Subscribe the page to receive leadgen webhooks
        try {
            metaStrategy.subscribePageToWebhooks(saved, pageToken);
        } catch (Exception e) {
            log.warn("Page webhook subscription failed for page={}: {}",
                    request.getSelectedPageId(), e.getMessage());
        }

        // Consume the session — one-time use
        state.setSessionStatus("CONSUMED");
        stateRepository.save(state);

        log.info("Meta connector created: id={}, page={} ({}), form={}",
                saved.getId(), pageName, request.getSelectedPageId(),
                request.getPlatformFormId());

        return ResponseEntity.ok(Map.of(
                "connector_id", saved.getId(),
                "page_name", pageName != null ? pageName : request.getSelectedPageId(),
                "status", "ACTIVE",
                "message", "Meta Lead Ads connector created successfully"
        ));
    }

    // ── Google connector (no OAuth) ───────────────────────────────────────────

    @PostMapping("/google/connector")
    public ResponseEntity<Map<String, String>> saveGoogleConnector(
            @RequestBody AdConnectorSetupRequest request) {

        if (request.getGoogleKey() == null || request.getAudienceId() == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "googleKey and audienceId are required"));
        }

        FormWebhookConnector connector = FormWebhookConnector.builder()
                .vendor("GOOGLE_LEAD_ADS")
                .vendorId(request.getGoogleKey())
                .instituteId(request.getInstituteId())
                .audienceId(request.getAudienceId())
                .platformFormId(request.getPlatformFormId())
                .routingRulesJson(request.getRoutingRulesJson())
                .fieldMappingJson(request.getFieldMappingJson())
                .producesSourceType("GOOGLE_ADS")
                .connectionStatus("ACTIVE")
                .isActive(true)
                .build();

        FormWebhookConnector saved = adPlatformWebhookService.saveConnector(connector, null);

        return ResponseEntity.ok(Map.of(
                "connector_id", saved.getId(),
                "webhook_url", "/admin-core-service/api/v1/webhook/google/" + request.getGoogleKey(),
                "status", "ACTIVE",
                "message", "Google Lead Form connector created. Paste the webhook_url in Google Ads."
        ));
    }

    // ── Connector list + deactivate (both platforms) ────────────────────────

    /**
     * List all active ad-platform connectors for an institute.
     * Returns safe data — no encrypted tokens.
     */
    @GetMapping("/connectors")
    public ResponseEntity<List<ConnectorListItemDTO>> listConnectors(
            @RequestParam String instituteId) {
        List<FormWebhookConnector> connectors = connectorRepository
                .findByInstituteIdAndIsActiveTrue(instituteId);

        List<ConnectorListItemDTO> result = connectors.stream()
                .filter(c -> "META_LEAD_ADS".equals(c.getVendor())
                        || "GOOGLE_LEAD_ADS".equals(c.getVendor()))
                .map(ConnectorListItemDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /**
     * Deactivate (soft-delete) a connector. Leads will stop flowing immediately.
     */
    @DeleteMapping("/connectors/{connectorId}")
    @Transactional
    public ResponseEntity<Map<String, String>> deactivateConnector(
            @PathVariable String connectorId) {
        FormWebhookConnector connector = connectorRepository.findById(connectorId)
                .orElseThrow(() -> new VacademyException("Connector not found"));
        connector.setIsActive(false);
        connector.setConnectionStatus("REVOKED");
        connectorRepository.save(connector);
        log.info("Deactivated connector id={} vendor={}", connectorId, connector.getVendor());
        return ResponseEntity.ok(Map.of("status", "deactivated"));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Decrypts the pages JSON blob and returns the raw list (includes token_enc entries).
     * Only used internally — never returned to the frontend.
     */
    private List<Map<String, String>> decryptAndListPages(OAuthConnectState state) {
        try {
            String pagesJson = tokenEncryptionService.decrypt(state.getPagesJsonEnc());
            return objectMapper.readValue(pagesJson,
                    new TypeReference<List<Map<String, String>>>() {});
        } catch (Exception e) {
            throw new VacademyException("Failed to read pages from session: " + e.getMessage());
        }
    }

    /**
     * Resolves and decrypts the page access token for a given page ID.
     * Token stays server-side — this result must never be returned to the client.
     */
    private String resolvePageToken(OAuthConnectState state, String pageId) {
        List<Map<String, String>> pages = decryptAndListPages(state);
        for (Map<String, String> page : pages) {
            if (pageId.equals(page.get("id"))) {
                String tokenEnc = page.get("token_enc");
                if (tokenEnc == null) throw new VacademyException(
                        "No token stored for page " + pageId);
                return tokenEncryptionService.decrypt(tokenEnc);
            }
        }
        throw new VacademyException("Page " + pageId + " not found in session");
    }

    private String resolvePageName(OAuthConnectState state, String pageId) {
        try {
            return decryptAndListPages(state).stream()
                    .filter(p -> pageId.equals(p.get("id")))
                    .map(p -> p.get("name"))
                    .findFirst().orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Build a redirect response to the admin frontend.
     * @param queryString appended as ?queryString (e.g. "session_key=uuid" or "error=denied")
     * @param fragment    optional URL fragment (may be null)
     */
    private ResponseEntity<Void> redirectToFrontend(String queryString, String fragment) {
        String base = frontendCallbackUrl;
        if (base == null || base.isBlank()) {
            log.warn("meta.oauth.frontend.callback.url not set; cannot redirect browser");
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
        // Use & if base already contains ?, otherwise use ?
        String separator = base.contains("?") ? "&" : "?";
        String url = base + separator + queryString;
        if (fragment != null) url += "#" + fragment;
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, url)
                .build();
    }
}
