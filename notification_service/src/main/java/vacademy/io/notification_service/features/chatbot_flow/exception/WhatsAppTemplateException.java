package vacademy.io.notification_service.features.chatbot_flow.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * A template-registration failure that carries enough context for the admin UI to say what actually
 * went wrong and what to do about it.
 *
 * <p>Before this existed, every failure in the template lifecycle was a bare
 * {@code RuntimeException}. The common {@code GlobalExceptionHandler} maps those to HTTP 511 with an
 * {@code ErrorInfo(url, ex, responseCode, date)} body — no {@code message} field — so the frontend's
 * {@code err.response.data.message} was always undefined and every failure surfaced as the generic
 * "Submit failed". Meta's real reason (bad name, sample-count mismatch, expired token, …) was
 * dropped on the floor.
 */
@Getter
public class WhatsAppTemplateException extends RuntimeException {

    /** HTTP status to return to the caller. */
    private final HttpStatus status;

    /** Stable machine-readable code, e.g. {@code TEMPLATE_NAME_EXISTS}. Safe for the UI to switch on. */
    private final String code;

    /** Builder field the user should fix ({@code name}, {@code bodyText}, {@code buttons[1].url}, …). Nullable. */
    private final String field;

    /** One line telling the admin what to do next. Nullable. */
    private final String hint;

    /** Provider's own numeric error code (Meta {@code error.code}), when the failure came from Meta/WATI. */
    private final String providerCode;

    /** Provider's error subcode (Meta {@code error.error_subcode}). */
    private final String providerSubcode;

    /** Meta's fbtrace_id — the only thing Meta support will ask for. Nullable. */
    private final String providerTraceId;

    private WhatsAppTemplateException(Builder b) {
        super(b.message, b.cause);
        this.status = b.status;
        this.code = b.code;
        this.field = b.field;
        this.hint = b.hint;
        this.providerCode = b.providerCode;
        this.providerSubcode = b.providerSubcode;
        this.providerTraceId = b.providerTraceId;
    }

    public static Builder builder(HttpStatus status, String code, String message) {
        return new Builder(status, code, message);
    }

    // ---- Shorthands for the cases this feature raises over and over ----

    /** Caller sent something Meta would reject. Points at the offending builder field. */
    public static WhatsAppTemplateException invalid(String code, String field, String message, String hint) {
        return builder(HttpStatus.BAD_REQUEST, code, message).field(field).hint(hint).build();
    }

    public static WhatsAppTemplateException notFound(String message) {
        return builder(HttpStatus.NOT_FOUND, "TEMPLATE_NOT_FOUND", message)
                .hint("Refresh the template list — it may have been deleted in another tab.")
                .build();
    }

    public static WhatsAppTemplateException conflict(String code, String message, String hint) {
        return builder(HttpStatus.CONFLICT, code, message).hint(hint).build();
    }

    /** Institute is missing WhatsApp provider config; nothing can be submitted until it's set. */
    public static WhatsAppTemplateException notConfigured(String message, String hint) {
        return builder(HttpStatus.FAILED_DEPENDENCY, "PROVIDER_NOT_CONFIGURED", message).hint(hint).build();
    }

    public static class Builder {
        private final HttpStatus status;
        private final String code;
        private final String message;
        private String field;
        private String hint;
        private String providerCode;
        private String providerSubcode;
        private String providerTraceId;
        private Throwable cause;

        Builder(HttpStatus status, String code, String message) {
            this.status = status;
            this.code = code;
            this.message = message;
        }

        public Builder field(String field) { this.field = field; return this; }
        public Builder hint(String hint) { this.hint = hint; return this; }
        public Builder providerCode(String providerCode) { this.providerCode = providerCode; return this; }
        public Builder providerSubcode(String providerSubcode) { this.providerSubcode = providerSubcode; return this; }
        public Builder providerTraceId(String providerTraceId) { this.providerTraceId = providerTraceId; return this; }
        public Builder cause(Throwable cause) { this.cause = cause; return this; }

        public WhatsAppTemplateException build() { return new WhatsAppTemplateException(this); }
    }
}
