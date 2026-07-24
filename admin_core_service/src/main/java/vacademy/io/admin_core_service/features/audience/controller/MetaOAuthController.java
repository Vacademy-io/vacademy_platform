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
import vacademy.io.admin_core_service.features.audience.dto.ConnectorHealthDTO;
import vacademy.io.admin_core_service.features.audience.dto.ConnectorListItemDTO;
import vacademy.io.admin_core_service.features.audience.dto.ConnectorUpdateRequest;
import vacademy.io.admin_core_service.features.audience.dto.MetaPageDTO;
import vacademy.io.admin_core_service.features.audience.dto.OAuthTokenResult;
import vacademy.io.admin_core_service.features.audience.dto.PlatformFormField;
import vacademy.io.admin_core_service.features.audience.dto.WebhookSubscriptionResult;
import vacademy.io.admin_core_service.features.audience.entity.FormWebhookConnector;
import vacademy.io.admin_core_service.features.audience.entity.OAuthConnectState;
import vacademy.io.admin_core_service.features.audience.repository.FormWebhookConnectorRepository;
import vacademy.io.admin_core_service.features.audience.repository.OAuthConnectStateRepository;
import vacademy.io.admin_core_service.features.audience.service.AdPlatformWebhookService;
import vacademy.io.admin_core_service.features.audience.service.MetaConnectorHealthService;
import vacademy.io.admin_core_service.features.audience.service.OAuthRedirectResolver;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.admin_core_service.features.audience.strategy.MetaLeadAdsStrategy;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
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
    private final MetaConnectorHealthService connectorHealthService;
    private final OAuthConnectStateRepository stateRepository;
    private final FormWebhookConnectorRepository connectorRepository;
    private final TokenEncryptionService tokenEncryptionService;
    private final OAuthRedirectResolver redirectResolver;
    private final ObjectMapper objectMapper;

    @Value("${meta.oauth.redirect.uri:}")
    private String metaRedirectUri;

    @Value("${meta.webhook.verify.token:}")
    private String metaWebhookVerifyToken;

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
            @RequestParam(required = false) String initiatedBy,
            @RequestParam(required = false) String frontendOrigin,
            @RequestHeader(value = "Origin", required = false) String originHeader,
            @RequestHeader(value = "Referer", required = false) String refererHeader) {

        // Remember which frontend origin started the flow so /callback can send the
        // browser back to the SAME (white-label) domain. Explicit param wins; else
        // fall back to the Origin/Referer of this authenticated request.
        String requestedOrigin = redirectResolver.normalizeOrigin(
                frontendOrigin != null && !frontendOrigin.isBlank() ? frontendOrigin
                        : (originHeader != null && !originHeader.isBlank() ? originHeader : refererHeader));

        OAuthConnectState state = OAuthConnectState.builder()
                .instituteId(instituteId)
                .vendor("META_LEAD_ADS")
                .audienceId(audienceId)
                .initiatedBy(initiatedBy)
                .frontendOrigin(requestedOrigin)
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

        // Resolve where to send the browser back to FIRST, so even error redirects
        // land on the origin the client started from (the state row carries it).
        String redirectBase = resolveRedirectBaseForState(state);

        // Meta sends error param if user denied access
        if (error != null) {
            log.warn("Meta OAuth denied by user: {}", error);
            return redirectToFrontend(redirectBase, "error=" + error);
        }

        if (state == null) {
            log.error("Meta OAuth callback received without state param");
            return redirectToFrontend(redirectBase, "error=missing_state");
        }

        // Validate the state record (prevents CSRF)
        OAuthConnectState stateRecord = stateRepository
                .findValidById(state, LocalDateTime.now())
                .orElse(null);

        if (stateRecord == null) {
            log.error("Meta OAuth callback: state={} not found or expired", state);
            return redirectToFrontend(redirectBase, "error=invalid_state");
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
                // Carry the connecting user's page tasks so the page selector can warn
                // about pages that lack the MANAGE (Full control) task — those can read
                // leads but Meta rejects the webhook subscribe (#200), so they'd never
                // actually deliver leads.
                if (page.get("tasks") != null) entry.put("tasks", page.get("tasks"));
                if (page.get("has_manage") != null) entry.put("has_manage", page.get("has_manage"));
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

            return redirectToFrontend(redirectBase, "session_key=" + state);

        } catch (Exception e) {
            log.error("Meta OAuth callback processing failed for state={}", state, e);
            stateRecord.setSessionStatus("EXPIRED");
            stateRepository.save(stateRecord);
            return redirectToFrontend(redirectBase, "error=server_error");
        }
    }

    /**
     * Resolve the validated frontend base URL for a callback, from the (possibly
     * expired) state row's stored origin + institute. Tolerant: any miss falls
     * back to the configured default inside {@link OAuthRedirectResolver}.
     */
    private String resolveRedirectBaseForState(String stateId) {
        if (stateId == null) {
            return redirectResolver.resolveRedirectBase(null, null);
        }
        OAuthConnectState s = stateRepository.findById(stateId).orElse(null);
        return redirectResolver.resolveRedirectBase(
                s != null ? s.getInstituteId() : null,
                s != null ? s.getFrontendOrigin() : null);
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
                .map(this::toPageDTO)
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

        // Subscribe the page to receive leadgen webhooks. This is the step that,
        // when it fails (Meta #200 — the connecting account lacks Full control of
        // the Page), used to be swallowed, leaving the connector falsely ACTIVE
        // with zero leads ever arriving. Capture the result and reflect it so the
        // admin gets an honest status + remediation instead of silent breakage.
        WebhookSubscriptionResult subResult;
        try {
            subResult = metaStrategy.subscribePageToWebhooks(saved, pageToken);
        } catch (Exception e) {
            log.warn("Page webhook subscription threw for page={}: {}",
                    request.getSelectedPageId(), e.getMessage());
            subResult = WebhookSubscriptionResult.failure(null, e.getMessage(),
                    "Couldn't link this Page to Vacademy. Try reconnecting.");
        }

        if (!subResult.isSuccess()) {
            saved.setConnectionStatus("ACTION_REQUIRED");
            saved.setStatusDetail(subResult.getRemediation());
            connectorRepository.save(saved);
        }

        // Keep the session AUTHORIZED so the admin can add more form→audience
        // connectors without re-running OAuth. Refresh the TTL on each save so an
        // actively-working admin doesn't hit the expiry mid-setup. The session
        // still expires naturally via expires_at (cleaned up by the scheduled job).
        state.setExpiresAt(LocalDateTime.now().plusMinutes(30));
        stateRepository.save(state);

        log.info("Meta connector created: id={}, page={} ({}), form={}, subscribed={}",
                saved.getId(), pageName, request.getSelectedPageId(),
                request.getPlatformFormId(), subResult.isSuccess());

        Map<String, String> body = new LinkedHashMap<>();
        body.put("connector_id", saved.getId());
        body.put("page_name", pageName != null ? pageName : request.getSelectedPageId());
        body.put("status", saved.getConnectionStatus());
        body.put("subscribed", String.valueOf(subResult.isSuccess()));
        body.put("message", subResult.isSuccess()
                ? "Meta Lead Ads connector created and the Page is linked for lead delivery."
                : subResult.getRemediation());
        return ResponseEntity.ok(body);
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
            @RequestParam String instituteId,
            @RequestParam(name = "includeAllVendors", defaultValue = "false") boolean includeAllVendors) {
        List<FormWebhookConnector> connectors = connectorRepository
                .findByInstituteIdAndIsActiveTrue(instituteId);

        // Default keeps the Integrations screen's existing behaviour (ad platforms only).
        // includeAllVendors=true surfaces every connector — incl. Zoho/Google/Microsoft
        // forms — for the Center Management screen, which edits per-center metadata.
        List<ConnectorListItemDTO> result = connectors.stream()
                .filter(c -> includeAllVendors
                        || "META_LEAD_ADS".equals(c.getVendor())
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

    // ── Connection health + re-subscribe ─────────────────────────────────────

    /**
     * Live health check ("Test connection") for a connector. Verifies the whole
     * lead-delivery chain — token, page→app subscription, lead-read access, and a
     * recent-lead heartbeat — and reflects a broken subscription into the
     * connector's status so the list view stays honest.
     */
    @GetMapping("/connectors/{connectorId}/health")
    public ResponseEntity<ConnectorHealthDTO> connectorHealth(@PathVariable String connectorId) {
        return ResponseEntity.ok(connectorHealthService.checkHealth(connectorId));
    }

    /**
     * Re-attempt the page→app webhook subscription using the connector's stored
     * token. Use after granting the connecting account Full control of the Page
     * (fixes the #200 case) — no need to redo the whole OAuth.
     */
    @PostMapping("/connectors/{connectorId}/resubscribe")
    @Transactional
    public ResponseEntity<Map<String, String>> resubscribeConnector(
            @PathVariable String connectorId) {
        FormWebhookConnector connector = connectorRepository.findById(connectorId)
                .orElseThrow(() -> new VacademyException("Connector not found"));
        if (!"META_LEAD_ADS".equals(connector.getVendor())) {
            throw new VacademyException("Re-subscribe is only supported for Meta connectors");
        }
        if (connector.getOauthAccessTokenEnc() == null) {
            throw new VacademyException(
                    "No stored token for this connector — reconnect the Page first.");
        }

        String pageToken = tokenEncryptionService.decrypt(connector.getOauthAccessTokenEnc());
        WebhookSubscriptionResult result = metaStrategy.subscribePageToWebhooks(connector, pageToken);

        if (result.isSuccess()) {
            connector.setConnectionStatus("ACTIVE");
            connector.setStatusDetail(null);
        } else {
            connector.setConnectionStatus("ACTION_REQUIRED");
            connector.setStatusDetail(result.getRemediation());
        }
        connector.setLastCheckedAt(LocalDateTime.now());
        connectorRepository.save(connector);

        Map<String, String> body = new LinkedHashMap<>();
        body.put("connector_id", connector.getId());
        body.put("status", connector.getConnectionStatus());
        body.put("subscribed", String.valueOf(result.isSuccess()));
        body.put("message", result.isSuccess()
                ? "Page re-subscribed — leads will now flow."
                : result.getRemediation());
        return ResponseEntity.ok(body);
    }

    // ── Manual lead poll (PULL) ──────────────────────────────────────────────

    /**
     * Pull leads for a Meta connector on demand via GET /{form_id}/leads, for the
     * last {@code sinceMinutes} minutes, and ingest them through the same pipeline
     * as the webhook. Use this when realtime push is blocked (Meta CRM access
     * revoked) to sync leads immediately, or to backfill history that arrived
     * before the connector/poller existed (pass a large sinceMinutes — Meta retains
     * ~90 days). Already-delivered leads dedup, so it's safe to run repeatedly.
     *
     * Advances the recurring poller's cursor to now on success so the scheduled job
     * continues seamlessly from here.
     *
     * Deliberately NOT @Transactional: each lead is submitted in its own
     * transaction (via AudienceService), exactly like the webhook path, so one bad
     * lead can't roll back the whole batch — and the blocking Graph API calls never
     * hold a DB connection.
     */
    @PostMapping("/connectors/{connectorId}/poll")
    public ResponseEntity<Map<String, Object>> pollConnectorNow(
            @PathVariable String connectorId,
            @RequestParam(required = false, defaultValue = "1440") int sinceMinutes) {
        FormWebhookConnector connector = connectorRepository.findById(connectorId)
                .orElseThrow(() -> new VacademyException("Connector not found"));
        if (!"META_LEAD_ADS".equals(connector.getVendor())) {
            throw new VacademyException("Polling is only supported for Meta connectors");
        }
        if (connector.getOauthAccessTokenEnc() == null) {
            throw new VacademyException("No stored token for this connector — reconnect the Page first.");
        }

        LocalDateTime pollStart = LocalDateTime.now();
        long sinceEpoch = pollStart.minusMinutes(Math.max(1, sinceMinutes)).toEpochSecond(ZoneOffset.UTC);

        AdPlatformWebhookService.PollResult result;
        try {
            // Generous page cap for manual backfill — a deep history pull can span many
            // pages (500 * 100 = up to 50k leads in one go).
            result = adPlatformWebhookService.pollMetaConnector(connector, sinceEpoch, 500);
        } catch (Exception e) {
            throw new VacademyException("Meta lead poll failed: " + e.getMessage());
        }

        // Advance the recurring cursor only if we fully drained; otherwise leave it so
        // the scheduled poller keeps retrying the older, un-fetched leads. Targeted
        // update (not a full-entity save) so we don't clobber a concurrent token/status
        // write to this row.
        if (!result.truncated()) {
            connectorRepository.updatePollCursor(connector.getId(), pollStart, result.newestLeadId());
        }

        log.info("Manual poll for connector {} (last {} min): fetched {} lead(s), truncated={}",
                connectorId, sinceMinutes, result.fetched(), result.truncated());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("connector_id", connectorId);
        body.put("fetched", result.fetched());
        body.put("since_minutes", sinceMinutes);
        body.put("truncated", result.truncated());
        body.put("message", result.truncated()
                ? "Pulled the most recent " + result.fetched() + " lead(s); the selected window "
                        + "holds more than a single sync returns. Contact support for a deeper backfill."
                : "Pulled " + result.fetched() + " lead(s) from Meta. New leads were ingested; "
                        + "any already delivered were deduped.");
        return ResponseEntity.ok(body);
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
     * Map a stored page entry to the safe DTO, deriving the Full-control warning.
     * A page without the MANAGE task can be selected but won't deliver leads —
     * Meta rejects the webhook subscribe with #200 — so we flag it up front.
     */
    private MetaPageDTO toPageDTO(Map<String, String> p) {
        String tasksCsv = p.getOrDefault("tasks", "");
        List<String> tasks = tasksCsv.isBlank()
                ? List.of()
                : Arrays.asList(tasksCsv.split(","));
        boolean hasManage = Boolean.parseBoolean(p.getOrDefault("has_manage", "false"))
                || tasks.contains("MANAGE");
        String warning = hasManage ? null
                : "You have Leads access to this Page but not Full control, which Facebook "
                + "requires to auto-sync leads. Ask a Page admin to grant your account Full "
                + "control, then reconnect.";
        return MetaPageDTO.builder()
                .id(p.get("id"))
                .name(p.get("name"))
                .tasks(tasks)
                .hasManageTask(hasManage)
                .canReceiveLeads(hasManage)
                .warning(warning)
                .build();
    }

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
     * @param base        resolved frontend base URL (client's own origin when
     *                    allowlisted, else the configured default)
     * @param queryString appended as ?queryString (e.g. "session_key=uuid" or "error=denied")
     */
    private ResponseEntity<Void> redirectToFrontend(String base, String queryString) {
        if (base == null || base.isBlank()) {
            log.warn("meta.oauth.frontend.callback.url not set; cannot redirect browser");
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
        // Use & if base already contains ?, otherwise use ?
        String separator = base.contains("?") ? "&" : "?";
        String url = base + separator + queryString;
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, url)
                .build();
    }
}
