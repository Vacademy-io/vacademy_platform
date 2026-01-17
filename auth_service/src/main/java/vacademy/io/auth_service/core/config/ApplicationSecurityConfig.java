package vacademy.io.auth_service.core.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
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
import vacademy.io.common.auth.filter.InternalAuthFilter;
import vacademy.io.common.auth.filter.JwtAuthFilter;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

@Configuration
@EnableMethodSecurity
public class ApplicationSecurityConfig {

    private static final String[] INTERNAL_PATHS = { "/auth-service/internal/**" };

    private static final String[] ALLOWED_PATHS = {
            "/auth-service/v1/internal/**",
            "/auth-service/v1/user/internal/create-user",
            "/auth-service/v1/user/internal/create-user-or-get-existing",
            "/auth-service/v1/user/internal/user-details-list",
            "/auth-service/v1/signup-root",
            "/auth-service/v1/refresh-token",
            "/auth-service/v1/login-root",
            "/auth-service/learner/v1/**",
            "/auth-service/actuator/**",
            "/auth-service/swagger-ui.html",
            "/auth-service/v1/report/alert/**",
            "/auth-service/v3/api-docs/**",
            "/auth-service/swagger-ui/**",
            "/auth-service/webjars/swagger-ui/**",
            "/auth-service/api-docs/**",
            "/auth-service/v1/send-password",
            "/auth-service/v1/user/internal/users-credential",
            "/auth-service/internal/v1/user-roles/users-of-status",
            "/auth-service/oauth2/**",
            "/auth-service/login/**",
            "/auth-service/public/v1/**",
            "/auth-service/v1/request-otp",
            "/auth-service/v1/login-otp",
            "/auth-service/v1/login",
            "/auth-service/open/**",
            "/auth-service/v1/server-time/**",
            "/auth-service/wordpress-webhook/**",
            "/auth-service/analytics/**",

            // User Resolution APIs for notification service - OPEN for internal
            // communication
            "/auth-service/v1/users/by-role",
            "/auth-service/v1/users/by-ids",

            // for whatsapp "thanks ak"
            "/auth-service/v1/request-whatsapp-otp",
            "/auth-service/v1/login-whatsapp-otp"
    };

    @Autowired
    JwtAuthFilter jwtAuthFilter;
    @Autowired
    UserDetailsService userDetailsService;

    @Autowired
    InternalAuthFilter internalAuthFilter;

    @Autowired
    private ClientRegistrationRepository clientRegistrationRepository;

    @Autowired
    private AuthenticationSuccessHandler customOAuth2SuccessHandler;

    @Autowired
    private AuthenticationFailureHandler customOAuth2FailureHandler;

    /**
     * Security filter chain for OAuth2 flows - Sessions enabled for OAuth2 state
     * management.
     * This is critical for multi-pod deployments where OAuth2 state must be shared
     * via Redis.
     * 
     * OAuth2 flow:
     * 1. User visits /auth-service/oauth2/authorization/google
     * 2. Spring creates OAuth2AuthorizationRequest and stores it in Redis session
     * 3. User redirects to Google
     * 4. Google redirects back to /auth-service/login/oauth2/code/google
     * 5. Spring retrieves OAuth2AuthorizationRequest from Redis session
     * 6. Authentication completes successfully across pods
     */
    @Bean
    @Order(1)
    public SecurityFilterChain oAuth2SecurityFilterChain(HttpSecurity http) throws Exception {
        http
                // Match OAuth2 paths - both with and without /auth-service prefix
                // The authorization starts at /auth-service/oauth2/authorization/google
                // But Google redirects back to /login/oauth2/code/google (no prefix)
                .securityMatcher("/auth-service/oauth2/**", "/auth-service/login/**", "/login/**")
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .maximumSessions(1))
                .authorizeHttpRequests(authz -> authz
                        .anyRequest().permitAll())
                .oauth2Login(oauth2 -> oauth2
                        .authorizationEndpoint(auth -> auth
                                .baseUri("/auth-service/oauth2/authorization")
                                .authorizationRequestRepository(authorizationRequestRepository())
                                .authorizationRequestResolver(
                                        new CustomAuthorizationRequestResolver(clientRegistrationRepository,
                                                "/auth-service/oauth2/authorization")))
                        .successHandler(customOAuth2SuccessHandler)
                        .failureHandler(customOAuth2FailureHandler));

        return http.build();
    }

    /**
     * Security filter chain for all other endpoints - STATELESS (no session
     * creation).
     * This includes:
     * - All JWT-authenticated API calls from users
     * - All internal service-to-service calls
     * - Health checks and actuator endpoints
     * 
     * This prevents memory issues from creating thousands of Redis sessions for
     * every API call.
     */
    @Bean
    @Order(2)
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authz -> {
                    // Use AntPathRequestMatcher for Ant-style pattern matching (compatible with
                    // Spring 6)
                    for (String path : ALLOWED_PATHS) {
                        authz.requestMatchers(AntPathRequestMatcher.antMatcher(path)).permitAll();
                    }
                    for (String path : INTERNAL_PATHS) {
                        authz.requestMatchers(AntPathRequestMatcher.antMatcher(path)).authenticated();
                    }
                    authz.anyRequest().authenticated();
                })
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

    @Bean
    public AuthorizationRequestRepository<OAuth2AuthorizationRequest> authorizationRequestRepository() {
        return new HttpSessionOAuth2AuthorizationRequestRepository();
    }

}
