import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

const BASE = `${BASE_URL}/admin-core-service/v1/oauth/meta`;
const WEBHOOK_BASE = `${BASE_URL}/admin-core-service/api/v1/webhook`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MetaPage {
    id: string;
    name: string;
}

export interface PlatformFormField {
    key: string;
    label: string;
    type: string;
    standardField: boolean;
}

export interface AdConnectorSetupRequest {
    vendor: string;
    instituteId: string;
    audienceId: string;
    platformPageId?: string;
    platformFormId: string;
    /** Human-readable form name (e.g. "Wakad_leadform_2026"). Persisted so the
     *  connector list can show names instead of opaque IDs. */
    platformFormName?: string;
    routingRulesJson?: string;
    fieldMappingJson?: string;
    producesSourceType?: string;
    sessionKey?: string;
    selectedPageId?: string;
    googleKey?: string;
    /**
     * Stringified JSON object of per-connector defaults stamped onto every
     * lead (e.g. '{"Center Name":"Wakad"}'). Form values always win.
     */
    defaultValuesJson?: string;
}

export interface ConnectorSaveResult {
    connector_id: string;
    status: string;
    message: string;
    page_name?: string;
    webhook_url?: string;
}

// ── Meta OAuth endpoints ─────────────────────────────────────────────────────

/** Step 1: Get Meta OAuth URL. Frontend navigates browser there. */
export const initiateMetaOAuth = async (
    instituteId: string,
    audienceId?: string
): Promise<{ oauth_url: string; session_key: string }> => {
    const params: Record<string, string> = { instituteId };
    if (audienceId) params.audienceId = audienceId;
    const res = await authenticatedAxiosInstance.post(`${BASE}/initiate`, null, { params });
    return res.data;
};

/** Step 3: Fetch pages for a session (after callback). Returns safe data — no tokens. */
export const getSessionPages = async (sessionKey: string): Promise<MetaPage[]> => {
    const res = await authenticatedAxiosInstance.get(`${BASE}/session/${sessionKey}/pages`);
    return res.data;
};

/** Step 4: Fetch form fields via the session (no token exposed to frontend). */
export const getFormFields = async (
    sessionKey: string,
    formId: string,
    pageId: string
): Promise<PlatformFormField[]> => {
    const res = await authenticatedAxiosInstance.get(
        `${BASE}/session/${sessionKey}/forms/${formId}/fields`,
        { params: { pageId } }
    );
    return res.data;
};

/** Step 4a: List lead gen forms for a page (after page selection). */
export const listPageForms = async (
    sessionKey: string,
    pageId: string
): Promise<{ id: string; name: string; status: string }[]> => {
    const res = await authenticatedAxiosInstance.get(
        `${BASE}/session/${sessionKey}/pages/${pageId}/forms`
    );
    return Array.isArray(res.data) ? res.data : [];
};

/** Step 5: Save a Meta connector. */
export const saveMetaConnector = async (
    request: AdConnectorSetupRequest
): Promise<ConnectorSaveResult> => {
    const res = await authenticatedAxiosInstance.post(`${BASE}/connector`, request);
    return res.data;
};

// ── Google endpoints ──────────────────────────────────────────────────────────

/** Save a Google Lead Form connector (no OAuth needed). */
export const saveGoogleConnector = async (
    request: AdConnectorSetupRequest
): Promise<ConnectorSaveResult> => {
    const res = await authenticatedAxiosInstance.post(`${BASE}/google/connector`, request);
    return res.data;
};

// ── Connector list + deactivate ───────────────────────────────────────────

export interface ConnectorListItem {
    id: string;
    vendor: string;
    /** Vendor-side id — e.g. the Zoho form code 'JS-114', the Meta form id, the Google key. */
    vendorId: string | null;
    audienceId: string;
    platformPageId: string | null;
    platformFormId: string | null;
    /** Human-readable form name captured at create time. Null on older rows. */
    platformFormName: string | null;
    connectionStatus: string;
    producesSourceType: string | null;
    createdAt: string | null;
    tokenExpiresAt: string | null;
    /**
     * Stringified JSON of per-connector default values merged into form payloads
     * at webhook time (e.g. center name, schedule link, school phone). Null/empty
     * means no defaults are configured.
     */
    defaultValuesJson: string | null;
}

/**
 * List active connectors for an institute. By default returns only ad-platform
 * connectors (Meta/Google) for the Integrations screen. Pass includeAllVendors=true
 * to also get Zoho/Google-Forms/Microsoft connectors for the Center Management screen.
 */
export const listConnectors = async (
    instituteId: string,
    includeAllVendors = false
): Promise<ConnectorListItem[]> => {
    const res = await authenticatedAxiosInstance.get(`${BASE}/connectors`, {
        params: includeAllVendors ? { instituteId, includeAllVendors: true } : { instituteId },
    });
    // Guard: API may return non-array on error or if endpoint isn't deployed yet
    return Array.isArray(res.data) ? res.data : [];
};

/** Deactivate (soft-delete) a connector. */
export const deactivateConnector = async (connectorId: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(`${BASE}/connectors/${connectorId}`);
};

/** Fetch a single connector by id (includes defaultValuesJson for editing). */
export const getConnector = async (connectorId: string): Promise<ConnectorListItem> => {
    const res = await authenticatedAxiosInstance.get<ConnectorListItem>(
        `${BASE}/connectors/${connectorId}`
    );
    return res.data;
};

/** Partial update of a connector. Only non-undefined fields are applied server-side. */
export interface ConnectorUpdateRequest {
    /**
     * Stringified JSON object, e.g.
     * '{"center name": "Baner", "Schedule Link": "https://...", "School Phone": "..."}'.
     * Pass '{}' to clear all defaults.
     */
    defaultValuesJson?: string;
}

export const updateConnector = async (
    connectorId: string,
    payload: ConnectorUpdateRequest
): Promise<ConnectorListItem> => {
    const res = await authenticatedAxiosInstance.put<ConnectorListItem>(
        `${BASE}/connectors/${connectorId}`,
        payload
    );
    return res.data;
};

/** Fetch custom fields configured for a specific audience (campaign). */
export interface AudienceCustomField {
    id: string;
    fieldName: string;
    fieldType: string;
}

export const fetchAudienceCustomFields = async (
    instituteId: string,
    audienceId: string
): Promise<AudienceCustomField[]> => {
    const res = await authenticatedAxiosInstance.get(
        `${BASE_URL}/admin-core-service/common/custom-fields/feature-fields`,
        { params: { instituteId, type: 'AUDIENCE_FORM', typeId: audienceId } }
    );
    const raw = Array.isArray(res.data) ? res.data : [];
    return raw.map(
        (r: { custom_field?: { id?: string; fieldName?: string; fieldType?: string } }) => ({
            id: r.custom_field?.id ?? '',
            fieldName: r.custom_field?.fieldName ?? '',
            fieldType: r.custom_field?.fieldType ?? 'TEXT',
        })
    );
};

/** Build field_mapping_json from the UI mapping rows. */
export const buildFieldMappingJson = (
    mappings: { platformKey: string; targetFieldName: string }[]
): string => {
    return JSON.stringify({
        mappings: mappings
            .filter((m) => m.platformKey && m.targetFieldName)
            .map((m) => ({
                platform_key: m.platformKey,
                // target uses the raw field_name — saveCustomFieldValuesByFieldName matches by name
                target: m.targetFieldName,
            })),
        unmapped_field_action: 'KEEP_ORIGINAL',
    });
};

/** Build the full Google webhook URL for display. */
export const buildGoogleWebhookUrl = (googleKey: string): string =>
    `${WEBHOOK_BASE}/google/${googleKey}`;
