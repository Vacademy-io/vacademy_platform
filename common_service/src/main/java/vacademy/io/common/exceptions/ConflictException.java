package vacademy.io.common.exceptions;

/**
 * Thrown when a request conflicts with the current state of a resource
 * (e.g. a duplicate, or an action disallowed by the resource's status).
 * Maps to HTTP 409.
 */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
