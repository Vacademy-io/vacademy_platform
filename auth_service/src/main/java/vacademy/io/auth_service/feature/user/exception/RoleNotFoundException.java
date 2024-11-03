package vacademy.io.auth_service.feature.user.exception;

public class RoleNotFoundException extends RuntimeException{

    public RoleNotFoundException(String message) {
        super(message);

    }
}
