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
                .allowedOriginPatterns(
                    "http://localhost:*", // All localhost ports
                    "https://*.vacademy.io", 
                    "https://*.codecircle.org",// All vacademy.io subdomains
                    "https://*.vacademy-platform.pages.dev" // All Cloudflare Pages subdomains
                )
                .allowedMethods("*")
                .allowCredentials(true) // Allow credentials with pattern matching
                .allowedHeaders("*"); // Allow any headers
    }

    // In one of your @Configuration classes
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}