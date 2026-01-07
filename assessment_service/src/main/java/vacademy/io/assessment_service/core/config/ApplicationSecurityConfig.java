package vacademy.io.assessment_service.core.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.NoOpPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.cors.CorsConfigurationSource;
import vacademy.io.assessment_service.core.filter.AssessmentJwtAuthFilter;
import vacademy.io.common.auth.filter.InternalAuthFilter;

@Configuration
@EnableMethodSecurity
public class ApplicationSecurityConfig {

    private static final String[] INTERNAL_PATHS = { "/assessment-service/internal/**" };

    private static final String[] ALLOWED_PATHS = { "/assessment-service/open-registrations/register/v1/**",
            "/assessment-service/question-paper/upload/docx/v1/**", "/assessment-service/actuator/**",
            "/assessment-service/swagger-ui.html", "/assessment-service/v1/report/alert/**",
            "/assessment-service/v3/api-docs/**", "/assessment-service/swagger-ui/**",
            "/assessment-service/webjars/swagger-ui/**", "/assessment-service/api-docs/**",
            "/assessment-service/open-registrations/v1/assessment-page", "/assessment-service/evaluation-tool/**",
            "/assessment-service/scheduler/test/**", "/assessment-service/assessment/evaluation-criteria/**",
            "/assessment-service/assessment/evaluation-ai/**" };

    @Autowired
    AssessmentJwtAuthFilter jwtAuthFilter;
    @Autowired
    UserDetailsService userDetailsService;

    @Autowired
    InternalAuthFilter internalAuthFilter;

    @Autowired
    private CorsConfigurationSource corsConfigurationSource;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // Modern Spring Security 6 syntax
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(ALLOWED_PATHS).permitAll()
                        .requestMatchers(INTERNAL_PATHS).authenticated()
                        .anyRequest().authenticated())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(internalAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return NoOpPasswordEncoder.getInstance();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authenticationProvider = new DaoAuthenticationProvider();
        authenticationProvider.setUserDetailsService(userDetailsService);
        authenticationProvider.setPasswordEncoder(passwordEncoder());
        return authenticationProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
