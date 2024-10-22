package vacademy.io.common.exceptions;

import org.springframework.http.HttpStatus;

// your custom exception class
public class LaborLinkException extends RuntimeException {

    private final HttpStatus status;

    public LaborLinkException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public LaborLinkException(String message){
        super(message);
        this.status = HttpStatus.NOT_EXTENDED;
    }

    public HttpStatus getStatus() {
        return this.status;
    }
}