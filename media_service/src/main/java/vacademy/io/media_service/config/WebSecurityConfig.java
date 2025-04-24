package vacademy.io.media_service.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;
import vacademy.io.common.auth.filter.HmacAuthFilter;
import vacademy.io.common.auth.filter.JwtAuthFilter;
import vacademy.io.common.auth.provider.ServiceAuthProvider;

@EnableWebSecurity
@Configuration
public class WebSecurityConfig {

    private static final String[] ALLOWED_PATHS = {"/media-service/ai/get-question/math-parser/**","/media-service/ai/get-question-pdf/math-parser/**", "/auth/**", "/media-service/ai/get-question/from-html", "/media-service/ai/get-question/from-text", "/media-service/ai/get-question/from-not-html", "/media-service/actuator/**", "/media-service/convert/doc-to-html", "/media-service/internal/**", "/internal/**", "/verify/id", "/media-service/swagger-ui.html", "/media-service/api-docs/**", "/swagger-ui.html", "/media-service/swagger-ui/index.html", "/media-service/v3/api-docs/**", "/media-service/swagger-ui/**", "/media-service/webjars/swagger-ui/**", "/media-service/public/**","/media-service/ai/get-question-audio/**","/media-service/ai/evaluation-tool/**","/media-service/ai/chat-with-pdf/**","/media-service/task-status/**","/media-service/ai/lecture/**"};
    @Autowired
    private JwtAuthFilter jwtAuthFilter; // Inject JwtAuthFilter dependency
    @Autowired
    private HmacAuthFilter hmacAuthFilter;
    @Autowired
    private CorsConfigurationSource corsConfigurationSource;

    // Bean to configure security filters and authorization rules
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf().disable() // Disable csrf protection as we're using JWT
                .authorizeHttpRequests()
                .requestMatchers(ALLOWED_PATHS) // Allow access to specific paths without authentication
                .permitAll()
                .anyRequest()
                .authenticated() // Require authentication for all other requests
                .and()
                .sessionManagement()
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS) // Use stateless JWT based authentication
                .and()
                .authenticationProvider(authenticationProvider()) // Use custom authentication provider
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class); // Add JWT filter before username/password filter

        return http.build();
    }

    // Bean for password encoder using BCrypt algorithm
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Bean for authentication provider using user details service and password encoder
    @Bean
    public AuthenticationProvider authenticationProvider() {
        return new ServiceAuthProvider();
    }

    // Bean to get AuthenticationManager from AuthenticationConfiguration
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
