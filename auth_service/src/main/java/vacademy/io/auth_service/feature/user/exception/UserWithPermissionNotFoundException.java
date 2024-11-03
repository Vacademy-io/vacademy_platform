package vacademy.io.auth_service.feature.user.exception;


public class UserWithPermissionNotFoundException extends RuntimeException{

    public UserWithPermissionNotFoundException(String message) {
        super(message);
    }
}
