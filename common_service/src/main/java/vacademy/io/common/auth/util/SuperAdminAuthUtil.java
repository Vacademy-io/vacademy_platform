package vacademy.io.common.auth.util;

import org.springframework.http.HttpStatus;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

public class SuperAdminAuthUtil {

    private SuperAdminAuthUtil() {
    }

    public static void requireSuperAdmin(CustomUserDetails user) {
        if (user == null || !user.isRootUser()) {
            throw new VacademyException(HttpStatus.FORBIDDEN, "Super admin access required");
        }
    }
}
