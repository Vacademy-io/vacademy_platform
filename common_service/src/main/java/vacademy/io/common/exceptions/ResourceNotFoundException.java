package vacademy.io.common.exceptions;

/** Thrown when a requested resource does not exist. Maps to HTTP 404. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
