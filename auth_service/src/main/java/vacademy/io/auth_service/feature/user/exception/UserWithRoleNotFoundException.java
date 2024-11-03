package vacademy.io.auth_service.feature.user.exception;

public class UserWithRoleNotFoundException extends RuntimeException{

    public UserWithRoleNotFoundException(String message) {
        super(message);
    }
}
