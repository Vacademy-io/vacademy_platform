package vacademy.io.common.exceptions;

public class UserWithRoleNotFoundException extends RuntimeException{

    public UserWithRoleNotFoundException(String message) {
        super(message);
    }
}
