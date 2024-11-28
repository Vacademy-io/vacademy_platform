package vacademy.io.common.exceptions;

import org.springframework.http.HttpStatus;

// your custom exception class
public class ExpiredTokenException extends VacademyException {
    public ExpiredTokenException(String message) {
        super(HttpStatus.FORBIDDEN, message);
    }

    public ExpiredTokenException() {
        super(HttpStatus.FORBIDDEN, "Login Once Again");
    }
}