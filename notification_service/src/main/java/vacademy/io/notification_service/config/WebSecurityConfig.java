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
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.cors.CorsConfigurationSource;
import vacademy.io.common.auth.filter.HmacAuthFilter;
import vacademy.io.common.auth.filter.JwtAuthFilter;
import vacademy.io.common.auth.provider.ServiceAuthProvider;

@EnableWebSecurity
@Configuration
public class WebSecurityConfig {

    private static final String[] ALLOWED_PATHS = {
            // Existing notification service paths
            "/notification-service/push-notifications/**",
            "/notification-service/v1/webhook/**",
            "/notification-service/v1/combot/**",
            "/notification-service/v1/tracking/**",
            "/notification-service/whatsapp/v1/send-template-whatsapp",
            "/notification-service/whatsapp/v1/send-template-whatsapp/multiple",
            "/auth/**",
            "/notification-service/v1/send-email",
            "/notification-service/actuator/**",
            "/actuator/**",
            "/notification-service/internal/**",
            "/notification-service/v1/send-email-to-users-public",
            "/internal/**",
            "/verify/id",
            "/notification-service/diagnostic/**",
            // Swagger and documentation
            "/notification-service/swagger-ui.html",
            "/notification-service/api-docs/**",
            "/swagger-ui.html",
            "/notification-service/swagger-ui/index.html",
            "/notification-service/v3/api-docs/**",
            "/notification-service/swagger-ui/**",
            "/notification-service/webjars/swagger-ui/**",
            "/notification-service/v1/**",

            // Announcement system APIs - OPEN for internal service communication
            "/notification-service/v1/announcements/**",
            "/notification-service/v1/user-messages/**",
            "/notification-service/v1/message-replies/**",
            "/notification-service/v1/institute-settings/**",
            // SSE streaming endpoints
            "/notification-service/v1/sse/**",
            "/notification-service/public/**",
            "/notification-service/health/**"
    };

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
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .authorizeHttpRequests(authz -> {
                    // Use AntPathRequestMatcher for Ant-style pattern matching (compatible with
                    // Spring 6)
                    for (String path : ALLOWED_PATHS) {
                        authz.requestMatchers(AntPathRequestMatcher.antMatcher(path)).permitAll();
                    }
                    authz.anyRequest().authenticated();
                })
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // Bean for password encoder using BCrypt algorithm
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Bean for authentication provider using user details service and password
    // encoder
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
