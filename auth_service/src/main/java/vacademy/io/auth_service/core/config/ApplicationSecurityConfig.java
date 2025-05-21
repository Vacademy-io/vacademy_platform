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
import org.springframework.security.oauth2.client.endpoint.DefaultAuthorizationCodeTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.cors.CorsConfigurationSource;
import vacademy.io.common.auth.filter.InternalAuthFilter;
import vacademy.io.common.auth.filter.JwtAuthFilter;

@Configuration
@EnableMethodSecurity
public class ApplicationSecurityConfig {


    private static final String[] INTERNAL_PATHS = {"/auth-service/internal/**"};

    private static final String[] ALLOWED_PATHS = {"/auth-service/v1/internal/**", "/auth-service/v1/user/internal/create-user", "/auth-service/v1/user/internal/create-user-or-get-existing", "/auth-service/v1/user/internal/user-details-list", "/auth-service/v1/signup-root", "/auth-service/v1/refresh-token", "/auth-service/v1/login-root", "/auth-service/learner/v1/**", "/auth-service/actuator/**", "/auth-service/swagger-ui.html", "/auth-service/v1/report/alert/**", "/auth-service/v3/api-docs/**", "/auth-service/swagger-ui/**", "/auth-service/webjars/swagger-ui/**", "/auth-service/api-docs/**", "/auth-service/v1/send-password", "/auth-service/v1/send-password", "/auth-service/v1/user/internal/users-credential   ", "/auth-service/internal/v1/user-roles/users-of-status","/auth-service/oauth2/**"};

    @Autowired
    JwtAuthFilter jwtAuthFilter;
    @Autowired
    UserDetailsService userDetailsService;

    @Autowired
    InternalAuthFilter internalAuthFilter;

    @Autowired
    private CorsConfigurationSource corsConfigurationSource;

    @Autowired
    private ClientRegistrationRepository clientRegistrationRepository;

    @Autowired
    private AuthenticationSuccessHandler customOAuth2SuccessHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf().disable()
                .cors().and()
                .sessionManagement()
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                .and()
                .authorizeHttpRequests(authz -> authz
                        .requestMatchers(ALLOWED_PATHS).permitAll()
                        .requestMatchers(INTERNAL_PATHS).authenticated()
                        .anyRequest().authenticated()
                )
                .oauth2Login(oauth2 -> oauth2
                        .authorizationEndpoint(auth -> auth
                                .authorizationRequestResolver(
                                        new CustomAuthorizationRequestResolver(clientRegistrationRepository, "/oauth2/authorization")
                                )
                        )
                        .successHandler(customOAuth2SuccessHandler) // Autowired or new instance
                )
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

    @Bean
    public OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> accessTokenResponseClient() {
        return new DefaultAuthorizationCodeTokenResponseClient();
    }

}
