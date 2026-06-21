package vacademy.io.admin_core_service.features.audience.strategy;

import vacademy.io.admin_core_service.features.audience.dto.NormalizedLeadData;
import vacademy.io.admin_core_service.features.audience.dto.OAuthTokenResult;
import vacademy.io.admin_core_service.features.audience.dto.PlatformFormField;
import vacademy.io.admin_core_service.features.audience.dto.WebhookSubscriptionResult;
import vacademy.io.admin_core_service.features.audience.entity.FormWebhookConnector;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Pluggable strategy for ad platform lead integrations.
 *
 * Implement this interface to support a new platform (LinkedIn, TikTok, etc.).
 * Each strategy handles one vendor code (e.g. "META_LEAD_ADS").
 *
 * Register the implementation as a Spring @Service — AdPlatformWebhookService
 * auto-discovers all strategies via @Autowired List<AdPlatformStrategy>.
 */
public interface AdPlatformStrategy {

    /** Vendor code that identifies this strategy (matches FormProviderEnum code). */
    String getVendorCode();

    // ── Webhook verification ─────────────────────────────────────────────────

    /**
     * Verify the webhook request's authenticity.
     *
     * @param signatureHeader the platform's signature header value (e.g. X-Hub-Signature-256 for Meta),
     *                        already extracted from the HTTP request before async dispatch
     * @param rawBody         raw request body as a pre-read string
     * @return true if the request is genuine
     */
    boolean verifyWebhookSignature(String signatureHeader, String rawBody);

    /**
     * Handle a platform verification/challenge request (e.g. Meta hub.challenge).
     * Return the challenge string to echo back, or empty if not applicable.
     */
    Optional<String> handleVerificationChallenge(Map<String, String> queryParams,
            String verifyToken);

    // ── Lead extraction ──────────────────────────────────────────────────────

    /**
     * Extract one or more lead events from the raw webhook body.
     * Each event contains the identifiers needed to fetch the full lead data.
     *
     * For Google: the payload IS the lead, so this returns the full data.
     * For Meta: the payload contains a leadgen_id that must be fetched separately.
     */
    List<NormalizedLeadData> extractAndFetchLeads(String rawBody,
            FormWebhookConnector connector);

    // ── OAuth flow ───────────────────────────────────────────────────────────

    /**
     * Build the OAuth authorization URL to redirect the user to the platform.
     *
     * @param stateToken opaque CSRF state token stored in oauth_connect_state
     * @param redirectUri callback URL registered with the platform
     * @return full authorization URL
     */
    String buildOAuthUrl(String stateToken, String redirectUri);

    /**
     * Exchange an authorization code for access + refresh tokens.
     */
    OAuthTokenResult exchangeCodeForToken(String code, String redirectUri);

    /**
     * List pages/accounts the user can connect (called after OAuth completes).
     * For Meta: lists Facebook Pages managed by the user.
     * For Google: may return account/campaign list or empty.
     */
    List<Map<String, String>> listConnectableAccounts(String accessToken);

    /**
     * Fetch the form fields for a given form ID (to help build the field mapping UI).
     */
    List<PlatformFormField> fetchFormFields(String formId, String accessToken);

    /**
     * Subscribe the connector's page to receive lead webhooks.
     * Called once after OAuth + page selection.
     *
     * @return a {@link WebhookSubscriptionResult} describing success or the
     *         platform error (e.g. Meta #200 when the connecting account lacks
     *         Full control of the Page). Callers MUST act on a failure instead
     *         of treating the connector as healthy.
     */
    WebhookSubscriptionResult subscribePageToWebhooks(FormWebhookConnector connector, String decryptedToken);

    // ── Token lifecycle ──────────────────────────────────────────────────────

    /**
     * Refresh an expiring token. Returns the new token and expiry, or empty if
     * the platform doesn't support refresh (caller should prompt re-auth).
     */
    Optional<OAuthTokenResult> refreshToken(FormWebhookConnector connector,
            String decryptedCurrentToken);
}
