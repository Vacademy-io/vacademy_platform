package vacademy.io.notification_service.features.chatbot_flow.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.notification_service.features.chatbot_flow.controller.WhatsAppTemplateController;
import vacademy.io.notification_service.features.chatbot_flow.controller.WhatsAppTemplateInternalController;

import java.time.Instant;

/**
 * Error handling for the WhatsApp-template endpoints.
 *
 * <p>Without this, everything here fell through to the platform-wide {@code GlobalExceptionHandler},
 * whose {@code RuntimeException} branch answers <b>HTTP 511 Network Authentication Required</b> with
 * an {@code ErrorInfo(url, ex, responseCode, date)} body. Two consequences the admin UI lived with:
 * the status was meaningless (a duplicate template name looked like an auth failure), and the body
 * had no {@code message} key, so the dashboard's {@code err.response.data.message} was always
 * undefined and every failure rendered as "Submit failed".
 *
 * <p>Scoped to the two template controllers by type — it deliberately does not change error handling
 * for any other endpoint in this service.
 */
@RestControllerAdvice(assignableTypes = {
        WhatsAppTemplateController.class,
        WhatsAppTemplateInternalController.class
})
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class WhatsAppTemplateExceptionHandler {

    @ExceptionHandler(WhatsAppTemplateException.class)
    public ResponseEntity<WhatsAppTemplateErrorResponse> handleTemplateError(WhatsAppTemplateException ex) {
        // 4xx is the admin's own input — noise at WARN. 5xx is ours or the provider's — full trace.
        if (ex.getStatus().is4xxClientError()) {
            log.warn("WhatsApp template error [{}]: {}", ex.getCode(), ex.getMessage());
        } else {
            log.error("WhatsApp template error [{}]: {}", ex.getCode(), ex.getMessage(), ex);
        }
        return build(ex.getStatus(), ex.getMessage(), ex.getCode(), ex.getField(), ex.getHint(),
                ex.getProviderCode(), ex.getProviderSubcode(), ex.getProviderTraceId());
    }

    /** Pre-existing call sites raise these (e.g. the duplicate-name 409); keep their status. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<WhatsAppTemplateErrorResponse> handleResponseStatus(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (status == null) status = HttpStatus.BAD_REQUEST;
        log.warn("WhatsApp template request rejected ({}): {}", status, ex.getReason());
        return build(status, ex.getReason() != null ? ex.getReason() : status.getReasonPhrase(),
                status == HttpStatus.CONFLICT ? "TEMPLATE_NAME_EXISTS" : "TEMPLATE_REQUEST_REJECTED",
                null, null, null, null, null);
    }

    /**
     * A provider call that escaped {@code WhatsAppProviderErrorTranslator}. Still far better than a
     * 511: the upstream body is what carries Meta's reason.
     */
    @ExceptionHandler(HttpStatusCodeException.class)
    public ResponseEntity<WhatsAppTemplateErrorResponse> handleUpstreamHttp(HttpStatusCodeException ex) {
        String body = ex.getResponseBodyAsString();
        log.error("Unhandled provider HTTP error: status={}, body={}", ex.getStatusCode(), body, ex);
        return build(HttpStatus.BAD_GATEWAY,
                "WhatsApp provider rejected the request (HTTP " + ex.getStatusCode().value() + ")"
                        + (body == null || body.isBlank() ? "." : ": " + body),
                "PROVIDER_REJECTED", null,
                "If this keeps happening, check the WhatsApp credentials in Settings → WhatsApp.",
                null, null, null);
    }

    @ExceptionHandler(ResourceAccessException.class)
    public ResponseEntity<WhatsAppTemplateErrorResponse> handleUnreachable(ResourceAccessException ex) {
        log.error("WhatsApp provider unreachable: {}", ex.getMessage(), ex);
        return build(HttpStatus.GATEWAY_TIMEOUT,
                "Could not reach the WhatsApp provider — the request timed out.",
                "PROVIDER_UNREACHABLE", null,
                "Try again in a moment, then click \"Sync Templates\" to check whether it went through.",
                null, null, null);
    }

    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<WhatsAppTemplateErrorResponse> handleRestClient(RestClientException ex) {
        log.error("WhatsApp provider call failed: {}", ex.getMessage(), ex);
        return build(HttpStatus.BAD_GATEWAY,
                "Call to the WhatsApp provider failed: " + ex.getMessage(),
                "PROVIDER_CALL_FAILED", null, null, null, null, null);
    }

    /** Unique-constraint on (institute_id, name, language) losing a race with a concurrent create. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<WhatsAppTemplateErrorResponse> handleIntegrity(DataIntegrityViolationException ex) {
        log.warn("Template write violated a DB constraint: {}", ex.getMostSpecificCause().getMessage());
        return build(HttpStatus.CONFLICT,
                "A template with this name and language already exists.",
                "TEMPLATE_NAME_EXISTS", "name",
                "Rename the template, or click \"Sync Templates\" to pull in the existing one.",
                null, null, null);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<WhatsAppTemplateErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Bad template request: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), "INVALID_REQUEST", null, null, null, null, null);
    }

    /** Malformed JSON body — a client bug, not a server one. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<WhatsAppTemplateErrorResponse> handleUnreadableBody(HttpMessageNotReadableException ex) {
        log.warn("Unreadable template request body: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST,
                "The template data could not be read — the request body was not valid JSON.",
                "MALFORMED_REQUEST_BODY", null, null, null, null, null);
    }

    /** e.g. calling /list or /sync without instituteId. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<WhatsAppTemplateErrorResponse> handleMissingParam(MissingServletRequestParameterException ex) {
        log.warn("Template request missing parameter: {}", ex.getParameterName());
        return build(HttpStatus.BAD_REQUEST,
                "Required parameter '" + ex.getParameterName() + "' is missing.",
                "MISSING_PARAMETER", ex.getParameterName(), null, null, null, null);
    }

    /**
     * Last resort. Returns 500 (not the platform default 511) and a body the UI can read, while the
     * stack trace stays in the logs rather than going out over the wire.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<WhatsAppTemplateErrorResponse> handleUnexpected(Exception ex) throws Exception {
        // Authn/authz failures belong to Spring Security's own handling. Turning a 403 into a
        // "something went wrong" 500 would both mislead the admin and hide a real permission problem.
        if (ex instanceof AccessDeniedException || ex instanceof AuthenticationException) {
            throw ex;
        }
        log.error("Unexpected WhatsApp template failure: {}", ex.getMessage(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR,
                "Something went wrong handling this template: " + ex.getMessage(),
                "TEMPLATE_UNEXPECTED_ERROR", null,
                "Nothing was changed. If it happens again, contact support with this message.",
                null, null, null);
    }

    private ResponseEntity<WhatsAppTemplateErrorResponse> build(
            HttpStatus status, String message, String code, String field, String hint,
            String providerCode, String providerSubcode, String providerTraceId) {
        return ResponseEntity.status(status).body(WhatsAppTemplateErrorResponse.builder()
                .message(message)
                .ex(message)
                .code(code)
                .field(field)
                .hint(hint)
                .providerCode(providerCode)
                .providerSubcode(providerSubcode)
                .providerTraceId(providerTraceId)
                .status(status.value())
                .timestamp(Instant.now().toString())
                .build());
    }
}
