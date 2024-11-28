package vacademy.io.common.exceptions;

import org.springframework.http.HttpStatus;

// your custom exception class
public class InvalidTokenException extends VacademyException {
    public InvalidTokenException(String message) {
        super(HttpStatus.UNAUTHORIZED, message);
    }
}