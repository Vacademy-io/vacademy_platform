package vacademy.io.admin_core_service.features.auth_service.constants;

public class AuthServiceRoutes {

    private AuthServiceRoutes() {
        // Private constructor to hide the implicit public one
    }

    public static final String INVITE_USER_ROUTE = "/auth-service/internal/v1/user-invitation/invite";
    public static final String GET_USERS_FROM_AUTH_SERVICE = "/auth-service/internal/user/user-details-list";
    public static final String UPDATE_USER_ROUTE = "/auth-service/v1/user/internal/update-user";
    public static final String UPDATE_PASSWORD_ROUTE = "/auth-service/v1/user-operation/update-password";
    public static final String GET_USER_BY_ID_WITH_PASSWORD = "/auth-service/internal/user/user-by-id-with-password";
    public static final String GENERATE_TOKEN_FOR_LEARNER = "/auth-service/v1/internal/generate-token-for-learner";
    public static final String SEND_CRED_TO_USERS = "/auth-service/internal/v1/user-operation/send-passwords";
    public static final String CREATE_OR_GET_EXISTING_BY_ID = "/auth-service/internal/user/create-or-get-existing-by-id";
    public static final String GET_STUDENT_LOGIN_STATS = "/auth-service/analytics/student-login-stats";
    public static final String CREATE_MULTIPLE_USERS = "/auth-service/v1/user/internal/create-multiple-users";
}
