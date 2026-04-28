package vacademy.io.admin_core_service.features.audience.dto;

import lombok.Data;

/**
 * Request body for partially updating a FormWebhookConnector from the admin UI.
 * Only fields that are non-null are applied — pass {@code defaultValuesJson} to
 * edit per-center metadata (the JSON merged into form payloads at webhook time).
 */
@Data
public class ConnectorUpdateRequest {
    /**
     * Stringified JSON object of default/static values, e.g.
     * {"center name": "Baner", "Schedule Link": "https://...", "School Phone": "..."}.
     * Pass an empty object "{}" to clear; null = don't touch.
     */
    private String defaultValuesJson;
}
