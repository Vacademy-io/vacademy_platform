package vacademy.io.common.exceptions;

/** Thrown when the caller lacks permission for an action. Maps to HTTP 403. */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
