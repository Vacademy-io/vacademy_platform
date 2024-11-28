package vacademy.io.common.exceptions;

import org.springframework.http.HttpStatus;

// your custom exception class
public class SiteNotFoundException extends VacademyException {
    public SiteNotFoundException(String message) {
        super(HttpStatus.I_AM_A_TEAPOT, message);
    }

    public SiteNotFoundException() {
        super(HttpStatus.I_AM_A_TEAPOT, "Site not found");
    }
}