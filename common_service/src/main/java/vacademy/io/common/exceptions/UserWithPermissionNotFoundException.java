package vacademy.io.common.exceptions;


public class UserWithPermissionNotFoundException extends RuntimeException{

    public UserWithPermissionNotFoundException(String message) {
        super(message);
    }
}
