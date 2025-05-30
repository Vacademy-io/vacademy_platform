package vacademy.io.notification_service.config;

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

    private static final String[] ALLOWED_PATHS = {"/auth/**", "/notification-service/actuator/**", "/notification-service/internal/**","/notification-service/v1/send-email-to-users-public", "/internal/**", "/verify/id", "/notification-service/swagger-ui.html", "/notification-service/api-docs/**", "/swagger-ui.html", "/notification-service/swagger-ui/index.html", "/notification-service/v3/api-docs/**", "/notification-service/swagger-ui/**", "/notification-service/webjars/swagger-ui/**", "notification-service/v1/**"};

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
