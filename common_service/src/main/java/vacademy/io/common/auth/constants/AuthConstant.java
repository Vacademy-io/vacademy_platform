package vacademy.io.common.auth.constants;

public class AuthConstant {
    public static String userServiceRoute = "/auth/internal/v1/user";
   public static Long jwtTokenExpiryInMillis = 604800000L;
    public static Long refreshTokenExpiryInSecs = 2592000L;
}
