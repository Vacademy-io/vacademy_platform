package vacademy.io.auth_service.core.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationContext;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.manager.AdminOAuth2Manager;
import vacademy.io.auth_service.feature.auth.manager.LearnerOAuth2Manager;
import vacademy.io.common.auth.service.OAuth2VendorToUserDetailService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

@Component
public class CustomOAuth2SuccessHandler implements AuthenticationSuccessHandler {
    private static final Logger log = LoggerFactory.getLogger(CustomOAuth2SuccessHandler.class);

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private OAuth2VendorToUserDetailService oAuth2VendorToUserDetailService;

    // Removed unused InstitutePolicyService field

    @Value("${teacher.portal.client.url}:https://dash.vacademy.io")
    private String adminPortalClientUrl;

    private static class DecodedState {
        String fromUrl;
        String instituteId;
        String userType; // "learner" | "admin"
        String accountType; // "signup" | "login"
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        log.debug("OAuth2 authentication success triggered");

        String encodedState = request.getParameter("state");
        log.debug("Received state parameter: {}", encodedState != null ? "[REDACTED]" : null);

        // Base fallback values
        String fallbackUrl = adminPortalClientUrl;
        DecodedState state = decodeState(encodedState, fallbackUrl);

        String redirectUrl = state.fromUrl != null ? state.fromUrl : fallbackUrl;
        String instituteId = state.instituteId;

        log.debug("Decoded state - fromUrl: {}, instituteId: {}, userType: {}, accountType: {}",
                  state.fromUrl, state.instituteId, state.userType, state.accountType);
        log.debug("Using redirect URL: {}", redirectUrl);

        // Waterfall: Prefer explicit state values; fall back to URL heuristics
        String derivedUserType = normalizeUserType(state.userType);
        if (derivedUserType == null) {
            derivedUserType = deriveUserTypeFromUrl(redirectUrl);
        }
        String derivedAccountType = normalizeAccountType(state.accountType);
        if (derivedAccountType == null) {
            derivedAccountType = deriveAccountTypeFromUrl(redirectUrl);
        }

        log.debug("Derived user type: {}, account type: {}", derivedUserType, derivedAccountType);

        if (redirectUrl == null) {
            log.warn("Redirect URL is null, cannot proceed");
            return;
        }

        log.info("OAuth2 redirect base URL: {} instituteId={} userType={} accountType={}", redirectUrl, instituteId, derivedUserType, derivedAccountType);

        if (!(authentication instanceof OAuth2AuthenticationToken oauthToken)) {
            log.error("Authentication is not OAuth2AuthenticationToken");
            sendErrorRedirect(response, redirectUrl, "invalid_authentication");
            return;
        }

        log.debug("Processing OAuth2 user for provider: {}", oauthToken.getAuthorizedClientRegistrationId());
        processOAuth2User(oauthToken, redirectUrl, response, encodedState, instituteId, derivedUserType, derivedAccountType);
    }

    private DecodedState decodeState(String encodedState, String fallbackUrl) {
        DecodedState result = new DecodedState();
        result.fromUrl = fallbackUrl; // default

        if (encodedState == null || encodedState.trim().isEmpty()) {
            return result;
        }

        try {
            // Step 1: Base64 decode
            byte[] decodedBytes = Base64.getUrlDecoder().decode(encodedState);
            String decodedJson = new String(decodedBytes, StandardCharsets.UTF_8);
            log.debug("Decoded Base64 state: {}", decodedJson);

            // Step 2: Parse JSON
            ObjectMapper mapper = new ObjectMapper();
            JsonNode stateNode = mapper.readTree(decodedJson);

            // Step 3: Extract "from" if present
            if (stateNode.has("from")) {
                String fromUrl = stateNode.get("from").asText();
                if (fromUrl != null && (fromUrl.startsWith("http://") || fromUrl.startsWith("https://"))) {
                    result.fromUrl = fromUrl;
                }
            }

            // Step 4: Extract "institute_id" if present
            if (stateNode.has("institute_id")) {
                result.instituteId = stateNode.get("institute_id").asText(null);
            }

            // Step 5: Extract user_type and account_type (accept snake_case or camelCase)
            if (stateNode.has("user_type")) {
                result.userType = stateNode.get("user_type").asText(null);
            } else if (stateNode.has("userType")) {
                result.userType = stateNode.get("userType").asText(null);
            }

            if (stateNode.has("account_type")) {
                result.accountType = stateNode.get("account_type").asText(null);
            } else if (stateNode.has("accountType")) {
                result.accountType = stateNode.get("accountType").asText(null);
            }

        } catch (Exception e) {
            log.warn("Failed to decode Base64 state parameter: {}", encodedState, e);
        }

        return result;
    }



    private void processOAuth2User(OAuth2AuthenticationToken oauthToken, String redirectUrl,
            HttpServletResponse response, String encodedState,String instituteId, String userType, String accountType) throws IOException {
        log.debug("Starting OAuth2 user processing for account type: {}", accountType);
        try {
            OAuth2User oauthUser = oauthToken.getPrincipal();
            Map<String, Object> attributes = oauthUser.getAttributes();
            String provider = oauthToken.getAuthorizedClientRegistrationId();
            log.debug("OAuth2 user attributes count: {}", attributes.size());

            UserInfo userInfo = extractUserInfo(attributes, provider, response, redirectUrl,instituteId);
            if (userInfo == null) {
                log.debug("UserInfo extraction returned null, aborting process");
                return;
            }

            String email = userInfo.email;
            log.debug("Initial email from OAuth2: {}", email != null ? "[EMAIL]" : null);
            log.debug("Provider ID: {}", userInfo.providerId);

            if (email == null || userInfo.providerId.equalsIgnoreCase("github")) {
                email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId,
                        userInfo.sub,userInfo.email);
                log.debug("Retrieved email from service: {}", email != null ? "[EMAIL]" : null);
            }
            boolean isEmailVerified = (email != null);
            log.debug("Email verified: {}", isEmailVerified);

            // Route by account type
            if ("signup".equalsIgnoreCase(accountType)) {
                log.debug("Routing to signup flow for user type: {}", userType);
                handleSignupFlow(userInfo, redirectUrl, response, encodedState, isEmailVerified, userType);
                return;
            }

            // Default/login
            log.debug("Routing to login flow for user type: {}", userType);
            handleLoginFlow(userInfo, redirectUrl, response, encodedState, isEmailVerified, userType);

        } catch (Exception e) {
            log.error("Failed during OAuth2 user processing", e);
            sendErrorRedirect(response, redirectUrl, e.getMessage());
        }
    }

    private void handleSignupFlow(UserInfo userInfo, String redirectUrl, HttpServletResponse response,
            String encodedState, boolean isEmailVerified, String userType) throws IOException {
        log.debug("Handling signup flow for user: {} with userType: {}", userInfo.name, userType);

        String email = userInfo.email;
        if (email == null || userInfo.providerId.equalsIgnoreCase("github")) {
            email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId, userInfo.sub,userInfo.email);
            log.debug("Retrieved email for signup: {}", email != null ? "[EMAIL]" : null);
        }

        // For signup, always return user data to frontend
       if (!"learner".equalsIgnoreCase(userType)) {
           log.debug("Processing admin signup flow");
           String userJson = null;
           if (email != null) {
               userJson = String.format(
                       "{\"name\":\"%s\", \"email\":\"%s\", \"profile\":\"%s\", \"sub\":\"%s\", \"provider\":\"%s\"}",
                       userInfo.name, email, userInfo.picture, userInfo.sub, userInfo.providerId);
           } else {
               userJson = String.format(
                       "{\"name\":\"%s\", \"profile\":\"%s\", \"sub\":\"%s\", \"provider\":\"%s\"}",
                       userInfo.name, userInfo.picture, userInfo.sub, userInfo.providerId);
           }

           String encodedUserInfo = Base64.getUrlEncoder()
                   .withoutPadding()
                   .encodeToString(userJson.getBytes(StandardCharsets.UTF_8));
           log.debug("Encoded user info for admin signup, length: {}", encodedUserInfo.length());

           String separator = redirectUrl.contains("?") ? "&" : "?";
           String redirectWithParams = String.format(
                   "%s%ssignupData=%s&state=%s&emailVerified=%s",
                   redirectUrl,
                   separator,
                   URLEncoder.encode(encodedUserInfo, StandardCharsets.UTF_8),
                   URLEncoder.encode(encodedState != null ? encodedState : "", StandardCharsets.UTF_8),
                   URLEncoder.encode(String.valueOf(isEmailVerified), StandardCharsets.UTF_8));
           log.debug("Admin signup redirect URL prepared");
           response.sendRedirect(redirectWithParams);
           oAuth2VendorToUserDetailService.saveOrUpdateOAuth2VendorToUserDetail(userInfo.providerId, email, userInfo.sub);
           log.debug("Admin signup flow completed");
       }else {
           log.debug("Processing learner signup flow");
           JwtResponseDto jwtResponseDto = getTokenByUserTypeAndUserEmail(userType, userInfo.name, email,
                   userInfo.instituteId);
           log.debug("Attempting to get token for learner signup, email: {}", email != null ? "[EMAIL]" : null);
          if (jwtResponseDto != null) {
              // User found, return token in URL
              log.debug("Learner user found, redirecting with tokens");
              redirectWithTokens(response, redirectUrl, jwtResponseDto);
              return;
          }
          log.debug("Learner user not found, returning user data for registration");
           String userJson = null;
           if (email != null) {
               userJson = String.format(
                       "{\"name\":\"%s\", \"email\":\"%s\", \"profile\":\"%s\", \"sub\":\"%s\", \"provider\":\"%s\"}",
                       userInfo.name, email, userInfo.picture, userInfo.sub, userInfo.providerId);
           } else {
               userJson = String.format(
                       "{\"name\":\"%s\", \"profile\":\"%s\", \"sub\":\"%s\", \"provider\":\"%s\"}",
                       userInfo.name, userInfo.picture, userInfo.sub, userInfo.providerId);
           }

           String encodedUserInfo = Base64.getUrlEncoder()
                   .withoutPadding()
                   .encodeToString(userJson.getBytes(StandardCharsets.UTF_8));

           String separator = redirectUrl.contains("?") ? "&" : "?";
           String redirectWithParams = String.format(
                   "%s%ssignupData=%s&state=%s&emailVerified=%s",
                   redirectUrl,
                   separator,
                   URLEncoder.encode(encodedUserInfo, StandardCharsets.UTF_8),
                   URLEncoder.encode(encodedState != null ? encodedState : "", StandardCharsets.UTF_8),
                   URLEncoder.encode(String.valueOf(isEmailVerified), StandardCharsets.UTF_8));
           response.sendRedirect(redirectWithParams);
           oAuth2VendorToUserDetailService.saveOrUpdateOAuth2VendorToUserDetail(userInfo.providerId, email, userInfo.sub);
           log.debug("Learner signup flow completed, user data returned to frontend");
       }
    }

    private void handleLoginFlow(UserInfo userInfo, String redirectUrl, HttpServletResponse response,
            String encodedState, boolean isEmailVerified, String userType) throws IOException {
        log.debug("Handling login flow for user: {} with userType: {}", userInfo.name, userType);

        String email = userInfo.email;
        if (email == null || userInfo.providerId.equalsIgnoreCase("github")) {
            email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId, userInfo.sub,userInfo.email);
            log.debug("Retrieved email for login: {}", email != null ? "[EMAIL]" : null);
        }

        // First try to login the user by email
        JwtResponseDto jwtResponseDto = getTokenByUserTypeAndUserEmail(userType, userInfo.name, email,
                userInfo.instituteId);
        log.debug("Attempted to get token for login, result: {}", jwtResponseDto != null ? "success" : "user not found");

        if (jwtResponseDto != null) {
            // User found, return token in URL
            log.debug("User found for login, redirecting with tokens");
            redirectWithTokens(response, redirectUrl, jwtResponseDto);
            return;
        }
        log.debug("User not found for login, returning user data to frontend");
        returnUserDataToFrontend(response, redirectUrl, userInfo, encodedState, isEmailVerified, true);
    }

    private void returnUserDataToFrontend(HttpServletResponse response, String redirectUrl, UserInfo userInfo,
            String encodedState, boolean isEmailVerified, boolean hasError) throws IOException {
        log.info("Redirecting with user handoff to base URL: {} hasError={}", redirectUrl, hasError);
        log.debug("Preparing user data for frontend return, hasError: {}", hasError);

        String email = userInfo.email;
        if (email == null || userInfo.providerId.equalsIgnoreCase("github")) {
            email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId, userInfo.sub,userInfo.email);
            log.debug("Retrieved email for frontend return: {}", email != null ? "[EMAIL]" : null);
        }

        String userJson = null;
        if (email != null) {
            userJson = String.format(
                    "{\"name\":\"%s\", \"email\":\"%s\", \"profile\":\"%s\", \"sub\":\"%s\", \"provider\":\"%s\"}",
                    userInfo.name, email, userInfo.picture, userInfo.sub, userInfo.providerId);
        } else {
            userJson = String.format(
                    "{\"name\":\"%s\", \"profile\":\"%s\", \"sub\":\"%s\", \"provider\":\"%s\"}",
                    userInfo.name, userInfo.picture, userInfo.sub, userInfo.providerId);
        }
        log.debug("Created user JSON for frontend, length: {}", userJson.length());

        String encodedUserInfo = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(userJson.getBytes(StandardCharsets.UTF_8));
        log.debug("Encoded user info for frontend return, length: {}", encodedUserInfo.length());

        String separator = redirectUrl.contains("?") ? "&" : "?";
        String redirectWithParams = String.format(
                "%s%ssignupData=%s&state=%s&emailVerified=%s%s",
                redirectUrl,
                separator,
                URLEncoder.encode(encodedUserInfo, StandardCharsets.UTF_8),
                URLEncoder.encode(encodedState != null ? encodedState : "", StandardCharsets.UTF_8),
                URLEncoder.encode(String.valueOf(isEmailVerified), StandardCharsets.UTF_8),
                hasError ? "&error=true" : "");
        log.debug("Frontend redirect URL prepared, will redirect with {} params", hasError ? "error=true" : "no error");
        response.sendRedirect(redirectWithParams);
    }

    private UserInfo extractUserInfo(Map<String, Object> attributes, String provider, HttpServletResponse response,
            String redirectUrl,String instituteId) throws IOException {
        String email = null;
        String name = null;
        String picture = null;
        String sub = null; // unique user ID
        String providerId = provider; // provider name: "google", "github", etc.

        if ("google".equals(provider)) {
            email = (String) attributes.get("email");
            name = (String) attributes.get("name");
            picture = (String) attributes.get("picture");
            sub = (String) attributes.get("sub"); // Google's unique user ID
            log.info("Google user logged in: {} ({})", name, email);
        } else if ("github".equals(provider)) {
            email = (String) attributes.get("email");
            name = (String) attributes.get("name");
            if (name == null) {
                name = (String) attributes.get("login");
            }
            picture = (String) attributes.get("avatar_url");
            sub = String.valueOf(attributes.get("id")); // GitHub's unique user ID
            log.info("GitHub user logged in: {} ({})", name, email);
        } else {
            log.warn("Unsupported OAuth2 provider: {}", provider);
            sendErrorRedirect(response, redirectUrl, "unsupported_provider");
            return null;
        }
        return new UserInfo(email, name, picture, providerId, sub, instituteId);
    }

    private record UserInfo(String email, String name, String picture, String providerId, String sub,
            String instituteId) {
    }

    private void redirectWithTokens(HttpServletResponse response, String redirectUrl, JwtResponseDto jwtResponseDto)
            throws IOException {
        log.info("Redirecting after login success to base URL: {} (tokens omitted)", redirectUrl);
        String separator = redirectUrl.contains("?") ? "&" : "?";
        String tokenizedRedirectUrl = String.format(
                "%s%saccessToken=%s&refreshToken=%s",
                redirectUrl,
                separator,
                URLEncoder.encode(jwtResponseDto.getAccessToken(), StandardCharsets.UTF_8),
                URLEncoder.encode(jwtResponseDto.getRefreshToken(), StandardCharsets.UTF_8));
        response.sendRedirect(tokenizedRedirectUrl);
    }

    private void sendErrorRedirect(HttpServletResponse response, String baseUrl, String errorMessage)
            throws IOException {
        log.warn("Redirecting with error to base URL: {} message={} ", baseUrl, errorMessage);
        if (response.isCommitted()) {
            log.warn("Cannot redirect because response is already committed. Error: {}", errorMessage);
            return;
        }
        String redirectUrl = baseUrl;
        if (!redirectUrl.contains("error=true")) {
            redirectUrl += redirectUrl.contains("?") ? "&error=true" : "?error=true";
        }
        redirectUrl += "&message=" + URLEncoder.encode(errorMessage, StandardCharsets.UTF_8);
        response.sendRedirect(redirectUrl);
    }

    private JwtResponseDto getTokenByUserTypeAndUserEmail(String userType, String fullName, String email,
            String instituteId) {
        try {
            if ("learner".equalsIgnoreCase(userType)) {
                return getLearnerOAuth2Manager().loginUserByEmail(fullName, email, instituteId);
            }
            return getAdminOAuth2Manager().loginUserByEmail(email);
        } catch (Exception e) {
            log.error("Failed to generate token for user: {}", email, e);
        }
        return null;
    }

    // Lazy initialization to break circular dependency
    private LearnerOAuth2Manager getLearnerOAuth2Manager() {
        return applicationContext.getBean(LearnerOAuth2Manager.class);
    }

    private AdminOAuth2Manager getAdminOAuth2Manager() {
        return applicationContext.getBean(AdminOAuth2Manager.class);
    }

    private String deriveUserTypeFromUrl(String url) {
        if (url == null) return "admin";
        return url.toLowerCase().contains("learner") ? "learner" : "admin";
    }

    private String deriveAccountTypeFromUrl(String url) {
        if (url == null) return "login";
        return url.toLowerCase().contains("signup") ? "signup" : "login";
    }

    private String normalizeUserType(String userType) {
        if (userType == null) return null;
        String normalized = userType.trim().toLowerCase();
        if ("learner".equals(normalized) || "admin".equals(normalized)) return normalized;
        return null;
    }

    private String normalizeAccountType(String accountType) {
        if (accountType == null) return null;
        String normalized = accountType.trim().toLowerCase();
        if ("signup".equals(normalized) || "login".equals(normalized)) return normalized;
        return null;
    }
}


