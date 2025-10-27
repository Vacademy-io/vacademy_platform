package vacademy.io.admin_core_service;

import io.sentry.Sentry;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import vacademy.io.common.auth.config.SharedConfigurationReference;

@SpringBootApplication
@Import(SharedConfigurationReference.class)
@EnableWebSecurity
@EnableAsync
@EnableScheduling
public class AdminCoreServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AdminCoreServiceApplication.class, args);

        // Test Sentry integration
        try {
            throw new Exception("This is a test exception to verify Sentry integration.");
        } catch (Exception e) {
            Sentry.captureException(e);
        }
    }
}
