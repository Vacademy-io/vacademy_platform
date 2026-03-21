package vacademy.io.auth_service.core.config;

import org.springframework.context.annotation.Configuration;
import vacademy.io.common.core.startup.EnvironmentValidator;

/**
 * Registers auth-service-specific required environment variables
 * for startup validation.
 */
@Configuration
public class EnvironmentValidationConfig {

    public EnvironmentValidationConfig(EnvironmentValidator validator) {
        validator.addRequiredVariables(
                "auth.server.baseurl",
                "application.my.username",
                "application.my.password"
        );
    }
}
