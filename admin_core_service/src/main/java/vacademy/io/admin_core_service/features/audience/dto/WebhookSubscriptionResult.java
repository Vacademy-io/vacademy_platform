package vacademy.io.admin_core_service.features.audience.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Result of attempting to subscribe a page/account to lead webhooks.
 *
 * Replaces the old fire-and-forget {@code void} return: the per-page
 * {@code POST /{page}/subscribed_apps} call can fail (most commonly Meta
 * error #200 — the connecting account lacks the {@code MANAGE} / Full-control
 * task on the Page) and that failure MUST be surfaced instead of swallowed,
 * otherwise the connector is saved ACTIVE while no leads will ever be delivered.
 */
@Data
@Builder
public class WebhookSubscriptionResult {

    /** True only when the platform confirmed the subscription succeeded. */
    private boolean success;

    /** Platform error code as a string (e.g. Meta "200"), null on success. */
    private String errorCode;

    /** Raw platform error message, null on success. */
    private String errorMessage;

    /** Human, actionable remediation shown to the admin, null on success. */
    private String remediation;

    public static WebhookSubscriptionResult ok() {
        return WebhookSubscriptionResult.builder().success(true).build();
    }

    public static WebhookSubscriptionResult failure(String errorCode, String errorMessage,
            String remediation) {
        return WebhookSubscriptionResult.builder()
                .success(false)
                .errorCode(errorCode)
                .errorMessage(errorMessage)
                .remediation(remediation)
                .build();
    }
}
