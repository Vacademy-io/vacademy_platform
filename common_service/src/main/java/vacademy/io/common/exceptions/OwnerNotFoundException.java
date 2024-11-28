package vacademy.io.common.exceptions;

import org.springframework.http.HttpStatus;

// your custom exception class
public class OwnerNotFoundException extends VacademyException {
    public OwnerNotFoundException(String message) {
        super(HttpStatus.CONFLICT, message);
    }

    public OwnerNotFoundException() {
        super(HttpStatus.CONFLICT, "Owner Not Found");
    }
}