package vacademy.io.common.core.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import vacademy.io.common.exceptions.ConflictException;
import vacademy.io.common.exceptions.ForbiddenException;
import vacademy.io.common.exceptions.InvalidRequestException;
import vacademy.io.common.exceptions.ResourceNotFoundException;
import vacademy.io.common.exceptions.UserNotFoundException;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Date;

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorInfo> handleUserNotFound(HttpServletRequest req, UserNotFoundException ex) {
        log.error("User Not Found: {} Stack Trace: {}", ex, ex.getStackTrace());
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
