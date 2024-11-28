package vacademy.io.auth_service.core.config;

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
import vacademy.io.common.auth.filter.InternalAuthFilter;
import vacademy.io.common.auth.filter.JwtAuthFilter;

@Configuration
@EnableMethodSecurity
public class ApplicationSecurityConfig {


    private static final String[] INTERNAL_PATHS = {"/auth-service/internal/**"};

    private static final String[] ALLOWED_PATHS = {"/auth-service/v1/signup-root", "/auth-service/v1/login-root" ,"/auth-service/actuator/**", "/auth-service/swagger-ui.html", "/auth-service/v1/report/alert/**", "/auth-service/v3/api-docs/**", "/auth-service/swagger-ui/**", "/auth-service/webjars/swagger-ui/**", "/auth-service/api-docs/**"};

    @Autowired
    JwtAuthFilter jwtAuthFilter;
    @Autowired
    UserDetailsService userDetailsService;

    @Autowired
    InternalAuthFilter internalAuthFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf().disable()
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
