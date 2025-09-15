package vacademy.io.community_service.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;


@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("*") // Allow requests from any origin
                .allowedMethods("*")
                .allowCredentials(true) // Allow any HTTP method (GET, POST, etc.)
                .allowedHeaders("*"); // Allow any headers
    }

    // In one of your @Configuration classes
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}