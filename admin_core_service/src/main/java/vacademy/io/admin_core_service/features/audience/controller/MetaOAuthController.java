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
import vacademy.io.admin_core_service.features.audience.dto.ConnectorUpdateRequest;
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
 *        → Server resolves page access token from session, creates connector, keeps session AUTHORIZED (TTL refreshed) for more connectors
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

    // ── Step 4a: List forms for a page ──────────────────────────────────────

    /**
     * List all lead gen forms for a given Facebook Page.
     * Returns [{id, name, status}] — no tokens exposed.
     */
    @GetMapping("/session/{sessionKey}/pages/{pageId}/forms")
    public ResponseEntity<List<Map<String, String>>> listPageForms(
            @PathVariable String sessionKey,
            @PathVariable String pageId) {

        OAuthConnectState state = stateRepository
                .findValidById(sessionKey, LocalDateTime.now())
                .orElseThrow(() -> new VacademyException("Session not found or expired"));

        String pageToken = resolvePageToken(state, pageId);
        List<Map<String, String>> forms = metaStrategy.listPageForms(pageId, pageToken);
        return ResponseEntity.ok(forms);
    }

    // ── Step 4b: Form fields ─────────────────────────────────────────────────

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
     * The session is kept AUTHORIZED (and its TTL refreshed) so the admin can add
     * multiple form→audience connectors from a single OAuth connection. It expires
     * naturally via expires_at — no longer single-use.
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

        // Upsert: update if connector already exists for this vendor + formId
        FormWebhookConnector connector = connectorRepository
                .findByVendorAndVendorId("META_LEAD_ADS", request.getPlatformFormId())
                .orElse(FormWebhookConnector.builder()
                        .vendor("META_LEAD_ADS")
                        .vendorId(request.getPlatformFormId())
                        .build());

        connector.setInstituteId(instituteId);
        connector.setAudienceId(audienceId);
        connector.setPlatformPageId(request.getSelectedPageId());
        connector.setPlatformFormId(request.getPlatformFormId());
        if (request.getPlatformFormName() != null) {
            connector.setPlatformFormName(request.getPlatformFormName());
        }
        connector.setRoutingRulesJson(request.getRoutingRulesJson());
        connector.setFieldMappingJson(request.getFieldMappingJson());
        if (request.getDefaultValuesJson() != null) {
            connector.setDefaultValuesJson(request.getDefaultValuesJson());
        }
        connector.setProducesSourceType(request.getProducesSourceType() != null
                ? request.getProducesSourceType() : "FACEBOOK_ADS");
        connector.setConnectionStatus("ACTIVE");
        connector.setWebhookVerifyToken(metaWebhookVerifyToken);
        connector.setIsActive(true);

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

        // Keep the session AUTHORIZED so the admin can add more form→audience
        // connectors without re-running OAuth. Refresh the TTL on each save so an
        // actively-working admin doesn't hit the expiry mid-setup. The session
        // still expires naturally via expires_at (cleaned up by the scheduled job).
        state.setExpiresAt(LocalDateTime.now().plusMinutes(30));
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

        // Upsert: update if connector already exists for this vendor + key
        FormWebhookConnector connector = connectorRepository
                .findByVendorAndVendorId("GOOGLE_LEAD_ADS", request.getGoogleKey())
                .orElse(FormWebhookConnector.builder()
                        .vendor("GOOGLE_LEAD_ADS")
                        .vendorId(request.getGoogleKey())
                        .build());

        connector.setInstituteId(request.getInstituteId());
        connector.setAudienceId(request.getAudienceId());
        connector.setPlatformFormId(request.getPlatformFormId());
        connector.setRoutingRulesJson(request.getRoutingRulesJson());
        connector.setFieldMappingJson(request.getFieldMappingJson());
        connector.setProducesSourceType("GOOGLE_ADS");
        connector.setConnectionStatus("ACTIVE");
        connector.setIsActive(true);

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

    /**
     * Fetch a single connector for editing. Returns the same safe DTO as the list endpoint
     * (no encrypted tokens) plus default_values_json so the admin UI can edit per-center metadata.
     */
    @GetMapping("/connectors/{connectorId}")
    public ResponseEntity<ConnectorListItemDTO> getConnector(@PathVariable String connectorId) {
        FormWebhookConnector connector = connectorRepository.findById(connectorId)
                .orElseThrow(() -> new VacademyException("Connector not found"));
        return ResponseEntity.ok(ConnectorListItemDTO.from(connector));
    }

    /**
     * Update editable fields on a connector. Currently exposes default_values_json — the
     * per-connector metadata (e.g. center name, schedule link, school phone) merged into
     * form payloads at webhook time. Validates that the body is a JSON object before saving.
     */
    @PutMapping("/connectors/{connectorId}")
    @Transactional
    public ResponseEntity<ConnectorListItemDTO> updateConnector(
            @PathVariable String connectorId,
            @RequestBody ConnectorUpdateRequest request) {
        FormWebhookConnector connector = connectorRepository.findById(connectorId)
                .orElseThrow(() -> new VacademyException("Connector not found"));

        if (request.getDefaultValuesJson() != null) {
            String trimmed = request.getDefaultValuesJson().trim();
            if (trimmed.isEmpty()) {
                connector.setDefaultValuesJson(null);
            } else {
                com.fasterxml.jackson.databind.JsonNode node;
                try {
                    node = objectMapper.readTree(trimmed);
                } catch (Exception e) {
                    throw new VacademyException(
                            "default_values_json must be a valid JSON object: " + e.getMessage());
                }
                // The V207 enrichment trigger reads default_values_json as a JSON object
                // (jsonb_each_text). Reject arrays/primitives so we never persist a shape
                // that would silently produce no enrichment.
                if (node == null || !node.isObject()) {
                    throw new VacademyException(
                            "default_values_json must be a JSON object (e.g. {\"center name\":\"...\"})");
                }
                connector.setDefaultValuesJson(trimmed);
            }
        }

        FormWebhookConnector saved = connectorRepository.save(connector);
        log.info("Updated connector id={} vendor={}", saved.getId(), saved.getVendor());
        return ResponseEntity.ok(ConnectorListItemDTO.from(saved));
    }

    // ── One-time backfill: platform_form_name on legacy connectors ───────────

    /**
     * Calls Meta Graph API for every active Meta connector whose
     * {@code platform_form_name} is null/blank and persists the returned name.
     * Idempotent — running it again only touches rows that are still missing.
     * Token decryption + Graph API calls happen synchronously; admins
     * typically have a handful of connectors so this is fine.
     *
     * Returns a summary so the admin sees what changed without tailing logs.
     */
    @PostMapping("/connectors/backfill-form-names")
    @Transactional
    public ResponseEntity<Map<String, Object>> backfillFormNames() {
        List<FormWebhookConnector> connectors = connectorRepository
                .findMissingPlatformFormName("META_LEAD_ADS");

        int updated = 0;
        int skipped = 0;
        List<String> skippedReasons = new ArrayList<>();

        for (FormWebhookConnector c : connectors) {
            String formId = c.getPlatformFormId();
            String tokenEnc = c.getOauthAccessTokenEnc();
            if (formId == null || tokenEnc == null) {
                skipped++;
                skippedReasons.add(c.getId() + " (missing form_id or token)");
                continue;
            }
            String pageToken;
            try {
                pageToken = tokenEncryptionService.decrypt(tokenEnc);
            } catch (Exception e) {
                skipped++;
                skippedReasons.add(c.getId() + " (decrypt failed: " + e.getMessage() + ")");
                continue;
            }
            String name = metaStrategy.fetchFormName(formId, pageToken);
            if (name == null) {
                skipped++;
                skippedReasons.add(c.getId() + " (Meta API returned no name)");
                continue;
            }
            c.setPlatformFormName(name);
            connectorRepository.save(c);
            updated++;
            log.info("Backfilled platform_form_name for connector {} → {}", c.getId(), name);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scanned", connectors.size());
        result.put("updated", updated);
        result.put("skipped", skipped);
        result.put("skipped_reasons", skippedReasons);
        log.info("Form-name backfill complete: scanned={}, updated={}, skipped={}",
                connectors.size(), updated, skipped);
        return ResponseEntity.ok(result);
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
