package vacademy.io.common.core.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.common.exceptions.ConflictException;
import vacademy.io.common.exceptions.ForbiddenException;
import vacademy.io.common.exceptions.InvalidRequestException;
import vacademy.io.common.exceptions.ResourceNotFoundException;
import vacademy.io.common.exceptions.UserNotFoundException;
import vacademy.io.common.exceptions.EnrollmentConflictException;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Date;

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorInfo> handleUserNotFound(HttpServletRequest req, UserNotFoundException ex) {
        log.warn("User Not Found: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorInfo(req.getRequestURL().toString(), ex.getLocalizedMessage(), String.valueOf(HttpStatus.NOT_FOUND), new Date()));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorInfo> handleResourceNotFound(HttpServletRequest req, ResourceNotFoundException ex) {
        log.warn("Resource Not Found: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorInfo(req.getRequestURL().toString(), ex.getLocalizedMessage(), String.valueOf(HttpStatus.NOT_FOUND), new Date()));
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ErrorInfo> handleForbidden(HttpServletRequest req, ForbiddenException ex) {
        log.warn("Forbidden: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorInfo(req.getRequestURL().toString(), ex.getLocalizedMessage(), String.valueOf(HttpStatus.FORBIDDEN), new Date()));
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorInfo> handleConflict(HttpServletRequest req, ConflictException ex) {
        log.warn("Conflict: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorInfo(req.getRequestURL().toString(), ex.getLocalizedMessage(), String.valueOf(HttpStatus.CONFLICT), new Date()));
    }

    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ErrorInfo> handleInvalidRequest(HttpServletRequest req, InvalidRequestException ex) {
        log.warn("Invalid Request: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorInfo(req.getRequestURL().toString(), ex.getLocalizedMessage(), String.valueOf(HttpStatus.BAD_REQUEST), new Date()));
    }

    /**
     * Enrollment conflicts keep VacademyException's 510 status -- deployed clients
     * match on "510" and must not change behaviour -- but carry an
     * ENROLLMENT_CONFLICT:<TYPE> marker in responseCode so a client can tell a real
     * conflict from an unrelated failure without matching human-readable copy.
     * Spring resolves to the most specific handler, so this wins over the
     * VacademyException one below regardless of declaration order.
     */
    @ExceptionHandler(EnrollmentConflictException.class)
    public ResponseEntity<ErrorInfo> handleEnrollmentConflict(HttpServletRequest req, EnrollmentConflictException ex) {
        log.info("Enrollment conflict ({}): {}", ex.getConflictType(), ex.getMessage());
        return ResponseEntity.status(ex.getStatus()).body(new ErrorInfo(req.getRequestURL().toString(), ex.getLocalizedMessage(), ex.getResponseCode(), new Date()));
    }

    /**
     * A {@link ResponseStatusException} already names the status the endpoint chose. Without this
     * handler the catch-all {@code RuntimeException} one below matches it -- Spring runs
     * ExceptionHandlerExceptionResolver BEFORE ResponseStatusExceptionResolver, so an
     * {@code @ExceptionHandler} on a supertype wins over the exception's own status -- and every
     * deliberate 400/401/403/404 went out as 511 with the reason mangled into prose. Clients that
     * branch on the reason code (chat's CHAT_DISABLED / DM_NOT_ALLOWED, the widget and support
     * endpoints' validation messages) skip anything >= 500, so those rejections silently degraded
     * into "something went wrong". Keep the original status and put the bare reason in
     * {@code message}.
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<StatusErrorInfo> handleResponseStatus(HttpServletRequest req, ResponseStatusException ex) {
        HttpStatusCode status = ex.getStatusCode();
        String reason = ex.getReason() != null ? ex.getReason() : ex.getMessage();
        if (status.is5xxServerError()) {
            log.error("Request failed ({}): {}", status.value(), reason, ex);
        } else {
            // A 4xx is the endpoint doing its job. Logging it at error level turns every business
            // rule into a Sentry issue, so it stays a warning -- same rule RequestTracingFilter uses.
            log.warn("Request rejected ({}): {}", status.value(), reason);
        }
        return ResponseEntity.status(status).body(new StatusErrorInfo(
                req.getRequestURL().toString(), reason, reason, String.valueOf(status.value()), new Date()));
    }

    @ExceptionHandler(VacademyException.class)
    public ResponseEntity<ErrorInfo> handleExceptionForOthers(HttpServletRequest req, VacademyException ex) {
        log.error("Vacademy Error: {} Stack Trace: {}", ex, ex.getStackTrace());
        return ResponseEntity.status(ex.getStatus()).body(new ErrorInfo(req.getRequestURL().toString(), ex.getLocalizedMessage(), String.valueOf(ex.getStatus()), new Date()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorInfo> handleRuntimeExceptionForOthers(HttpServletRequest req, RuntimeException ex) {
        log.error("Vacademy Error: {} Stack Trace: {}", ex, ex.getStackTrace());
        return ResponseEntity.status(HttpStatus.NETWORK_AUTHENTICATION_REQUIRED).body(new ErrorInfo(req.getRequestURL().toString(), ex.getLocalizedMessage(), String.valueOf(ex.getMessage()), new Date()));
    }

}
