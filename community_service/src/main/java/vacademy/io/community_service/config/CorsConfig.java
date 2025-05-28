package vacademy.io.community_service.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;


@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("http://localhost:5173", "http://localhost:3020" ,"https://dash.vacademy.io", "https://learner.vacademy.io", "https://afddd839.vacademy-platform.pages.dev", "https://engage.vacademy.io/", "https://www.engage.vacademy.io/") // Allow requests from any origin
                .allowedMethods("*")
                .allowCredentials(true) // Allow any HTTP method (GET, POST, etc.)
                .allowedHeaders("*"); // Allow any headers
    }
}