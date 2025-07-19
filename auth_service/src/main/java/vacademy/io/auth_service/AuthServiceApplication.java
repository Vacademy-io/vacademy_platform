package vacademy.io.auth_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import vacademy.io.common.auth.config.SharedConfigurationReference;

@SpringBootApplication
@Import(SharedConfigurationReference.class)
@EnableWebSecurity
public class AuthServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(AuthServiceApplication.class, args);
        
    }
}
