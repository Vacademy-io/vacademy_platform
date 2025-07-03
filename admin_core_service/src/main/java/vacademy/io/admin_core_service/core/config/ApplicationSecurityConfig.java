package vacademy.io.admin_core_service.core.config;

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
import vacademy.io.common.auth.filter.InternalAuthFilter;
import vacademy.io.common.auth.filter.JwtAuthFilter;

@Configuration
@EnableMethodSecurity
public class ApplicationSecurityConfig {


    private static final String[] INTERNAL_PATHS = {"/admin-core-service/internal/**"};


    private static final String[] ALLOWED_PATHS = {"/admin-core-service/open/**","/admin-core-service/batch/v1/search","/admin-core-service/public/**","/admin-core-service/live-presenter/v1/**", "/admin-core-service/live-learner/v1/**", "/admin-core-service/institute/open_learner/v1/**", "/admin-core-service/institute/v1/internal/create", "/admin-core-service/learner/v1/details/**", "/admin-core-service/actuator/**", "/admin-core-service/swagger-ui.html", "/admin-core-service/v1/report/alert/**", "/admin-core-service/v3/api-docs/**", "/admin-core-service/swagger-ui/**", "/admin-core-service/webjars/swagger-ui/**", "/admin-core-service/api-docs/**", "/admin-core-service/learner-invitation-response/**" , "/admin-core-service/live-session/register-guest-user/**"  , "admin-core-service/live-session/get-earliest-schedule-id/**" , "/admin-core-service/live-session/get-registration-data/**" , "/admin-core-service/live-session/check-email-registration/**" , "/admin-core-service/live-session/guest/get-session-by-schedule-id/**" , "/admin-core-service/live-session/mark-guest-attendance","/admin-core-service/course/ai/v1/**"};
    @Autowired
    JwtAuthFilter jwtAuthFilter;
    @Autowired
    UserDetailsService userDetailsService;

    @Autowired
    InternalAuthFilter internalAuthFilter;

    @Autowired
    private CorsConfigurationSource corsConfigurationSource;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf().disable()
                .cors()
                .and()
                .authorizeHttpRequests()
                .requestMatchers(ALLOWED_PATHS).permitAll()
                .requestMatchers(INTERNAL_PATHS).authenticated()
                .anyRequest().authenticated()
                .and()
                .sessionManagement()
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                .and()
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
