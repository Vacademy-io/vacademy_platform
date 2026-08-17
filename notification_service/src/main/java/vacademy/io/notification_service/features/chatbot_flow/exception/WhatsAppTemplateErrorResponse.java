package vacademy.io.notification_service.features.chatbot_flow.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;

/**
 * Error body for the WhatsApp-template endpoints.
 *
 * <p>{@code message} is the field the admin dashboard already reads
 * ({@code err.response.data.message}); {@code ex} carries the same text so anything written against
 * the platform-wide {@code ErrorInfo} shape keeps working.
 */
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WhatsAppTemplateErrorResponse(
        /* Human-readable, already phrased for an admin — safe to toast verbatim. */
        String message,
        /* Same text under the platform's legacy ErrorInfo key so old readers don't regress. */
        String ex,
        /* Stable machine code, e.g. TEMPLATE_NAME_EXISTS, META_TOKEN_EXPIRED. */
        String code,
        /* Which builder field to highlight, when the failure is attributable to one. */
        String field,
        /* What the admin should do next. */
        String hint,
        /* Meta/WATI numeric error code + subcode, when the failure came from the provider. */
        String providerCode,
        String providerSubcode,
        /* Meta's fbtrace_id — quote this to Meta support. */
        String providerTraceId,
        int status,
        String timestamp) {
}
