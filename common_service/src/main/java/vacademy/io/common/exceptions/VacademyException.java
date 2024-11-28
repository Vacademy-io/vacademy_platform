package vacademy.io.common.exceptions;

import org.springframework.http.HttpStatus;

// your custom exception class
public class VacademyException extends RuntimeException {

    private final HttpStatus status;

    public VacademyException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public VacademyException(String message){
        super(message);
        this.status = HttpStatus.NOT_EXTENDED;
    }

    public HttpStatus getStatus() {
        return this.status;
    }
}