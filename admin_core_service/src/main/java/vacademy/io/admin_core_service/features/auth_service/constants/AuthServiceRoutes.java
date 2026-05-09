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
    public static final String GET_USERS_WITH_CHILDREN = "/auth-service/v1/user/internal/users-with-children";
    public static final String GET_USER_BY_MOBILE = "/auth-service/v1/user/internal/user-by-mobile";
    public static final String UPDATE_INSTITUTE_SETTINGS = "/auth-service/internal/institute-settings";
    public static final String AUTOSUGGEST_USERS = "/auth-service/internal/user/autosuggest-users";

    /**
     * Substring search on full_name / email / mobile_number, optionally scoped to
     * an institute. Returns user IDs only. Used by the leads search bar to
     * pre-fetch matching users from auth_service so admin_core can OR them
     * against ar.user_id in its own audience_response query.
     */
    public static final String SEARCH_USER_IDS = "/auth-service/internal/user/search-ids";

    /**
     * Returns users with a given role for a specific institute.
     * Query params: instituteId, roleName.
     * Used by the doubt-notification cascade to fall back to ADMIN users when no faculty is mapped.
     */
    public static final String GET_USERS_BY_ROLE = "/auth-service/v1/users/by-role";

    /**
     * Idempotently adds the supplied roles to a user (no-op when the user
     * already has an ACTIVE row for that {institute, role}). HMAC-internal
     * variant of {@code /auth-service/v1/user-roles/add-user-roles}.
     *
     * <p>Body: {@code { user_id, roles, institute_id }} (snake_case).
     *
     * <p>Used by the bulk-assign flow to make sure existing-user enrollments
     * (e.g. leads) get the {@code STUDENT} role so the learner-portal login
     * passes its role check.
     */
    public static final String ADD_USER_ROLES_INTERNAL = "/auth-service/internal/v1/user-roles/add-user-roles";
}
