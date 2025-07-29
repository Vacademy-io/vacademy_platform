package vacademy.io.auth_service.feature.auth.constants;

import java.util.List;

public class AuthConstants {

    public static final String CREATE_INSTITUTES_PATH = "/admin-core-service/institute/v1/internal/create";

    public static final String ADMIN_ROLE = "ADMIN";

    public static final String STUDENT_ROLE = "STUDENT";

    public static final String LEARNER_ENROLL_PATH = "/admin-core-service/v1/learner/enroll";

    public static final List<String> VALID_ROLES_FOR_ADMIN_PORTAL = List.of("ADMIN","TEACHER","EVALUATOR");

    public  static final List<String> VALID_ROLES_FOR_STUDENT_PORTAL = List.of("STUDENT");
}
