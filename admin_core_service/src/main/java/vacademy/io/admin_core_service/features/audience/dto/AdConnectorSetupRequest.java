package vacademy.io.admin_core_service.features.audience.dto;

import lombok.Data;

/**
 * Request body for creating or updating an ad platform connector.
 * Used from the frontend when an admin completes the OAuth flow and
 * configures field mapping + routing rules.
 */
@Data
public class AdConnectorSetupRequest {
    /** Vendor code: META_LEAD_ADS or GOOGLE_LEAD_ADS */
    private String vendor;

    /** Institute ID this connector belongs to */
    private String instituteId;

    /** Default audience ID for leads that don't match any routing rule */
    private String audienceId;

    /** Platform page ID (Meta: Facebook Page ID) */
    private String platformPageId;

    /** Platform form ID (Meta: Lead Gen Form ID) */
    private String platformFormId;

    /** Human-readable form name shown in the connector list (e.g.
     *  "Wakad_leadform_2026"). Captured from the form-selection dropdown so
     *  the backend can persist it without re-querying Meta. */
    private String platformFormName;

    /** Platform page name for display */
    private String platformPageName;

    /** JSON routing rules (optional — see V201 migration for format) */
    private String routingRulesJson;

    /** JSON field mapping (see V201 migration for format) */
    private String fieldMappingJson;

    /** Source type: FACEBOOK_ADS, INSTAGRAM_ADS, or GOOGLE_ADS */
    private String producesSourceType;

    /**
     * For Meta: the session UUID returned from /callback (stored as state in oauth_connect_state).
     * The server uses this to look up the encrypted page token — the token never leaves the server.
     */
    private String sessionKey;

    /**
     * For Meta: the Facebook Page ID the admin selected from the pages list.
     * Combined with sessionKey to retrieve the correct page access token server-side.
     */
    private String selectedPageId;

    /** Google-specific: the static key that will be embedded in the webhook URL */
    private String googleKey;

    /**
     * Optional JSON object of per-connector default values stamped onto every
     * lead (e.g. {"Center Name":"Wakad"}). Form values always take precedence.
     */
    private String defaultValuesJson;
}
