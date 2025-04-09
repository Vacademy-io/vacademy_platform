package vacademy.io.scheduler_service;


import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import vacademy.io.common.auth.config.SharedConfigurationReference;

@SpringBootApplication
@Import(SharedConfigurationReference.class)
@EnableWebSecurity
public class SchedulerServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(SchedulerServiceApplication.class, args);
    }
}