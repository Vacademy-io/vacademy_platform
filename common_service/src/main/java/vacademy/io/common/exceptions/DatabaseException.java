package vacademy.io.common.exceptions;

import org.springframework.http.HttpStatus;

// your custom exception class
public class DatabaseException extends LaborLinkException {
    public DatabaseException(String message) {
        super(HttpStatus.NOT_EXTENDED, message);
    }

    public DatabaseException() {
        super(HttpStatus.NOT_EXTENDED, "Database Exception");
    }
}