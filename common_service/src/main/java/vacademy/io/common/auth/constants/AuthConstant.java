package vacademy.io.common.auth.constants;

public class AuthConstant {
    public static String userServiceRoute = "/auth-service/v1/internal/user";
    public static Long jwtTokenExpiryInMillis = 2592000000L;
    public static Long refreshTokenExpiryInSecs = 5184000L;
}
