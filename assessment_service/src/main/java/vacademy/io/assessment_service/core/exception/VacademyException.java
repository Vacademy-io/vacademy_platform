package vacademy.io.assessment_service.core.exception;

public class VacademyException extends RuntimeException {
    public VacademyException(String message) {
        super(message);
    }

    public VacademyException(String message, Throwable cause) {
        super(message, cause);
    }
}
