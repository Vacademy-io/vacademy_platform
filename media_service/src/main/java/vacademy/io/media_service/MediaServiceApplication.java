package vacademy.io.media_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import vacademy.io.common.auth.config.SharedConfigurationReference;

@SpringBootApplication
@Import(SharedConfigurationReference.class)

@EnableWebSecurity
@EnableAsync
public class MediaServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(MediaServiceApplication.class, args);
    }

}
