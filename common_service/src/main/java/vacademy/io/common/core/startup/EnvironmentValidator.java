package vacademy.io.common.core.startup;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationStartedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Validates that required environment variables are set on service startup.
 * Logs a clear error message listing missing variables and fails fast
 * instead of letting the service crash later with cryptic errors.
 *
 * Usage: Each service should define a bean that calls
 * {@link #addRequiredVariables(String...)} to register its required vars.
 */
@Component
public class EnvironmentValidator {

    private static final Logger log = LoggerFactory.getLogger(EnvironmentValidator.class);

    private final Environment environment;
    private final List<String> requiredVariables = new ArrayList<>();

    /**
     * Common variables required by all microservices.
     */
    private static final String[] COMMON_REQUIRED = {
            "spring.datasource.url",
            "spring.datasource.username",
            "spring.datasource.password",
    };

    public EnvironmentValidator(Environment environment) {
        this.environment = environment;
        // Register common variables by default
        addRequiredVariables(COMMON_REQUIRED);
    }

    /**
     * Register additional required variables for a specific service.
     */
    public void addRequiredVariables(String... variables) {
        for (String var : variables) {
            if (!requiredVariables.contains(var)) {
                requiredVariables.add(var);
            }
        }
    }

    @EventListener(ApplicationStartedEvent.class)
    public void validateEnvironment() {
        List<String> missing = new ArrayList<>();

        for (String variable : requiredVariables) {
            String value = environment.getProperty(variable);
            if (value == null || value.isBlank()) {
                missing.add(variable);
            }
        }

        if (!missing.isEmpty()) {
            String message = String.format(
                    "STARTUP VALIDATION FAILED: The following required environment variables are missing or empty: %s",
                    String.join(", ", missing)
            );
            log.error("=".repeat(80));
            log.error(message);
            log.error("Please set these variables before starting the service.");
            log.error("=".repeat(80));
            throw new IllegalStateException(message);
        }

        log.info("Environment validation passed. All {} required variables are set.",
                requiredVariables.size());
    }
}
