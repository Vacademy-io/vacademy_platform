package vacademy.io.common.exceptions;

import org.springframework.http.HttpStatus;

// your custom exception class
public class EmployeeNotFoundException extends VacademyException {
    public EmployeeNotFoundException(String message) {
        super(HttpStatus.CONFLICT, message);
    }

    public EmployeeNotFoundException() {
        super(HttpStatus.CONFLICT, "Employee Not Found");
    }
}