package vacademy.io.common.exceptions;

import org.springframework.http.HttpStatus;

// your custom exception class
public class EventNotFoundException extends LaborLinkException {
    public EventNotFoundException(String message) {
        super(HttpStatus.EXPECTATION_FAILED, message);
    }

    public EventNotFoundException() {
        super(HttpStatus.EXPECTATION_FAILED, "Event not found");
    }
}