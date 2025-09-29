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
import vacademy.io.auth_service.feature.admin_core_service.service.InstitutePolicyService;
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

    @Autowired
    private InstitutePolicyService institutePolicyService; // Although injected, it's not used. Kept as is.

    @Value("${teacher.portal.client.url}:https://dash.vacademy.io")
    private String adminPortalClientUrl;

    private static class DecodedState {
        String fromUrl;
        String instituteId;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        log.info("OAuth2 authentication successful. Starting success handling process.");

        String encodedState = request.getParameter("state");
        log.debug("Received encoded state parameter: {}", encodedState);

        // Base fallback values
        String fallbackUrl = adminPortalClientUrl;
        log.debug("Using fallback URL: {}", fallbackUrl);

        DecodedState state = decodeState(encodedState, fallbackUrl);
        log.info("Decoded state - fromUrl: '{}', instituteId: '{}'", state.fromUrl, state.instituteId);

        String redirectUrl = state.fromUrl != null ? state.fromUrl : fallbackUrl;
        String instituteId = state.instituteId;

        if (redirectUrl == null) {
            log.error("Redirect URL is null after decoding state. Aborting process.");
            // Although the logic implies 'fromUrl' will have a fallback, this is a safeguard.
            return;
        }
        log.debug("Final redirect URL determined: {}", redirectUrl);

        if (!(authentication instanceof OAuth2AuthenticationToken oauthToken)) {
            log.error("Authentication object is not an instance of OAuth2AuthenticationToken. It is: {}",
                    authentication.getClass().getName());
            sendErrorRedirect(response, redirectUrl, "invalid_authentication_type");
            return;
        }

        log.info("Proceeding to process OAuth2 user details.");
        processOAuth2User(oauthToken, redirectUrl, response, encodedState, instituteId);
    }

    private DecodedState decodeState(String encodedState, String fallbackUrl) {
        log.debug("Attempting to decode state parameter...");
        DecodedState result = new DecodedState();
        result.fromUrl = fallbackUrl; // Set default fallback URL

        if (encodedState == null || encodedState.trim().isEmpty()) {
            log.warn("State parameter is null or empty. Using fallback URL: {}", fallbackUrl);
            return result;
        }

        try {
            log.debug("Decoding Base64 URL-encoded state: {}", encodedState);
            byte[] decodedBytes = Base64.getUrlDecoder().decode(encodedState);
            String decodedJson = new String(decodedBytes, StandardCharsets.UTF_8);
            log.info("Successfully decoded state to JSON: {}", decodedJson);

            ObjectMapper mapper = new ObjectMapper();
            JsonNode stateNode = mapper.readTree(decodedJson);

            if (stateNode.has("from")) {
                String fromUrl = stateNode.get("from").asText();
                if (fromUrl != null && (fromUrl.startsWith("http://") || fromUrl.startsWith("https://"))) {
                    result.fromUrl = fromUrl;
                    log.debug("Extracted 'from' URL from state: {}", result.fromUrl);
                } else {
                    log.warn("Invalid 'from' URL found in state: {}. Using fallback.", fromUrl);
                }
            } else {
                log.debug("'from' attribute not found in state. Will use fallback URL.");
            }

            if (stateNode.has("institute_id")) {
                result.instituteId = stateNode.get("institute_id").asText(null);
                log.debug("Extracted 'institute_id' from state: {}", result.instituteId);
            } else {
                log.debug("'institute_id' attribute not found in state.");
            }

        } catch (Exception e) {
            log.warn("Failed to decode or parse the state parameter: '{}'. Error: {}. Using fallback URL.", encodedState, e.getMessage());
        }

        log.debug("Finished decoding state. FromURL: '{}', InstituteID: '{}'", result.fromUrl, result.instituteId);
        return result;
    }

    private void processOAuth2User(OAuth2AuthenticationToken oauthToken, String redirectUrl,
                                   HttpServletResponse response, String encodedState, String instituteId) throws IOException {
        log.info("Processing user from OAuth2 token for provider: {}", oauthToken.getAuthorizedClientRegistrationId());
        try {
            OAuth2User oauthUser = oauthToken.getPrincipal();
            Map<String, Object> attributes = oauthUser.getAttributes();
            String provider = oauthToken.getAuthorizedClientRegistrationId();
            log.debug("User attributes received from provider '{}': {}", provider, attributes);

            UserInfo userInfo = extractUserInfo(attributes, provider, response, redirectUrl, instituteId);
            if (userInfo == null) {
                log.warn("User info could not be extracted. Aborting process.");
                return;
            }
            log.info("Extracted UserInfo: Name='{}', Email='{}', Provider='{}', Sub='{}', InstituteId='{}'",
                    userInfo.name, userInfo.email, userInfo.providerId, userInfo.sub, userInfo.instituteId);

            String email = userInfo.email;
            if (email == null || userInfo.providerId.equalsIgnoreCase("github")) {
                log.info("Email is null or provider is GitHub. Attempting to fetch email from DB for sub: {}", userInfo.sub);
                email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId, userInfo.sub, userInfo.email);
                log.info("Email fetched from DB: {}", email);
            }
            boolean isEmailVerified = (email != null);
            log.debug("Email verification status set to: {}", isEmailVerified);

            // Logic to distinguish between signup and login flows
            if (redirectUrl.contains("signup")) {
                log.info("Detected SIGNUP flow from redirect URL: {}", redirectUrl);
                handleSignupFlow(userInfo, redirectUrl, response, encodedState, isEmailVerified);
            } else {
                log.info("Detected LOGIN flow from redirect URL: {}", redirectUrl);
                handleLoginFlow(userInfo, redirectUrl, response, encodedState, isEmailVerified);
            }

        } catch (Exception e) {
            log.error("An unexpected error occurred during OAuth2 user processing.", e);
            sendErrorRedirect(response, redirectUrl, "internal_processing_error");
        }
    }

    private void handleSignupFlow(UserInfo userInfo, String redirectUrl, HttpServletResponse response,
                                  String encodedState, boolean isEmailVerified) throws IOException {
        log.info("Handling signup flow for user: {}", userInfo.email);
        String email = userInfo.email;
        if (email == null || userInfo.providerId.equalsIgnoreCase("github")) {
            log.debug("Re-fetching email for signup flow for sub: {}", userInfo.sub);
            email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId, userInfo.sub, userInfo.email);
        }

        if (!redirectUrl.contains("learner")) {
            log.info("Signup flow is for an Admin/Teacher portal.");
            // For admin/teacher signup, always return user data to the frontend to complete the form
            returnUserDataToFrontend(response, redirectUrl, userInfo, encodedState, isEmailVerified, false);
            oAuth2VendorToUserDetailService.saveOrUpdateOAuth2VendorToUserDetail(userInfo.providerId, email, userInfo.sub);
            log.info("Saved/Updated OAuth vendor details for user: {}", email);
        } else {
            log.info("Signup flow is for a Learner portal.");
            // For learner, first check if they already exist
            JwtResponseDto jwtResponseDto = getTokenByClientUrlAndUserEmail(redirectUrl, userInfo.name, email,
                    userInfo.instituteId);
            if (jwtResponseDto != null) {
                log.info("Learner '{}' already exists during signup flow. Logging them in directly.", email);
                redirectWithTokens(response, redirectUrl, jwtResponseDto);
            } else {
                log.info("New learner '{}' in signup flow. Returning data to frontend.", email);
                returnUserDataToFrontend(response, redirectUrl, userInfo, encodedState, isEmailVerified, false);
                oAuth2VendorToUserDetailService.saveOrUpdateOAuth2VendorToUserDetail(userInfo.providerId, email, userInfo.sub);
                log.info("Saved/Updated OAuth vendor details for new learner: {}", email);
            }
        }
    }

    private void handleLoginFlow(UserInfo userInfo, String redirectUrl, HttpServletResponse response,
                                 String encodedState, boolean isEmailVerified) throws IOException {
        log.info("Handling login flow for user based on email associated with sub: {}", userInfo.sub);
        String email = userInfo.email;
        if (email == null || userInfo.providerId.equalsIgnoreCase("github")) {
            log.debug("Re-fetching email for login flow for sub: {}", userInfo.sub);
            email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId, userInfo.sub, userInfo.email);
        }
        log.info("Attempting login for user email: {}", email);

        JwtResponseDto jwtResponseDto = getTokenByClientUrlAndUserEmail(redirectUrl, userInfo.name, email,
                userInfo.instituteId);

        if (jwtResponseDto != null) {
            log.info("Successfully generated tokens for user '{}'. Redirecting with tokens.", email);
            redirectWithTokens(response, redirectUrl, jwtResponseDto);
        } else {
            log.warn("Login failed for user '{}' - user not found in our system. Redirecting to signup.", email);
            returnUserDataToFrontend(response, redirectUrl, userInfo, encodedState, isEmailVerified, true);
        }
    }

    private void returnUserDataToFrontend(HttpServletResponse response, String redirectUrl, UserInfo userInfo,
                                          String encodedState, boolean isEmailVerified, boolean hasError) throws IOException {
        log.info("Preparing to return user data to frontend. EmailVerified: {}, HasError: {}", isEmailVerified, hasError);
        String email = userInfo.email;
        if (email == null || userInfo.providerId.equalsIgnoreCase("github")) {
            email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId, userInfo.sub, userInfo.email);
        }

        String userJson;
        if (email != null) {
            userJson = String.format(
                    "{\"name\":\"%s\", \"email\":\"%s\", \"profile\":\"%s\", \"sub\":\"%s\", \"provider\":\"%s\"}",
                    userInfo.name, email, userInfo.picture, userInfo.sub, userInfo.providerId);
        } else {
            userJson = String.format(
                    "{\"name\":\"%s\", \"profile\":\"%s\", \"sub\":\"%s\", \"provider\":\"%s\"}",
                    userInfo.name, userInfo.picture, userInfo.sub, userInfo.providerId);
        }
        log.debug("Constructed user JSON for frontend: {}", userJson);

        String encodedUserInfo = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(userJson.getBytes(StandardCharsets.UTF_8));

        String separator = redirectUrl.contains("?") ? "&" : "?";
        String redirectWithParams = String.format(
                "%s%ssignupData=%s&state=%s&emailVerified=%s%s",
                redirectUrl,
                separator,
                URLEncoder.encode(encodedUserInfo, StandardCharsets.UTF_8),
                URLEncoder.encode(encodedState != null ? encodedState : "", StandardCharsets.UTF_8),
                URLEncoder.encode(String.valueOf(isEmailVerified), StandardCharsets.UTF_8),
                hasError ? "&error=true" : "");

        log.info("Redirecting to frontend with user data: {}", redirectWithParams);
        response.sendRedirect(redirectWithParams);
    }

    private UserInfo extractUserInfo(Map<String, Object> attributes, String provider, HttpServletResponse response,
                                     String redirectUrl, String instituteId) throws IOException {
        log.debug("Extracting user info for provider: {}", provider);
        String email = null;
        String name = null;
        String picture = null;
        String sub = null;

        switch (provider) {
            case "google":
                email = (String) attributes.get("email");
                name = (String) attributes.get("name");
                picture = (String) attributes.get("picture");
                sub = (String) attributes.get("sub");
                log.info("Extracted from Google: Email='{}', Name='{}', Sub='{}'", email, name, sub);
                break;
            case "github":
                email = (String) attributes.get("email");
                name = (String) attributes.get("name");
                if (name == null) {
                    name = (String) attributes.get("login");
                    log.debug("GitHub name is null, using login '{}' instead.", name);
                }
                picture = (String) attributes.get("avatar_url");
                sub = String.valueOf(attributes.get("id"));
                log.info("Extracted from GitHub: Email='{}', Name='{}', Sub='{}'", email, name, sub);
                break;
            default:
                log.error("Unsupported OAuth2 provider detected: {}", provider);
                sendErrorRedirect(response, redirectUrl, "unsupported_provider");
                return null;
        }
        return new UserInfo(email, name, picture, provider, sub, instituteId);
    }

    private record UserInfo(String email, String name, String picture, String providerId, String sub,
                            String instituteId) {
    }

    private void redirectWithTokens(HttpServletResponse response, String redirectUrl, JwtResponseDto jwtResponseDto)
            throws IOException {
        log.info("Preparing to redirect with access and refresh tokens.");
        String separator = redirectUrl.contains("?") ? "&" : "?";
        String tokenizedRedirectUrl = String.format(
                "%s%saccessToken=%s&refreshToken=%s",
                redirectUrl,
                separator,
                URLEncoder.encode(jwtResponseDto.getAccessToken(), StandardCharsets.UTF_8),
                URLEncoder.encode(jwtResponseDto.getRefreshToken(), StandardCharsets.UTF_8));

        log.info("Redirecting to: {}", tokenizedRedirectUrl);
        response.sendRedirect(tokenizedRedirectUrl);
    }

    private void sendErrorRedirect(HttpServletResponse response, String baseUrl, String errorMessage)
            throws IOException {
        if (response.isCommitted()) {
            log.warn("Cannot send error redirect because response is already committed. Error message was: {}", errorMessage);
            return;
        }
        String redirectUrl = baseUrl;
        if (!redirectUrl.contains("error=true")) {
            redirectUrl += redirectUrl.contains("?") ? "&error=true" : "?error=true";
        }
        redirectUrl += "&message=" + URLEncoder.encode(errorMessage, StandardCharsets.UTF_8);
        log.warn("Sending error redirect to: {}", redirectUrl);
        response.sendRedirect(redirectUrl);
    }

    private JwtResponseDto getTokenByClientUrlAndUserEmail(String clientUrl, String fullName, String email,
                                                           String instituteId) {
        if (email == null) {
            log.warn("Cannot get token because user email is null.");
            return null;
        }
        try {
            if (clientUrl.contains("learner")) {
                log.info("Getting token for LEARNER portal. Email: {}, InstituteId: {}", email, instituteId);
                return getLearnerOAuth2Manager().loginUserByEmail(fullName, email, instituteId);
            } else {
                log.info("Getting token for ADMIN/TEACHER portal. Email: {}", email);
                return getAdminOAuth2Manager().loginUserByEmail(email);
            }
        } catch (Exception e) {
            log.error("Failed to generate token for user '{}'. Exception: {}", email, e.getMessage());
            // It's often better to log the full stack trace for debugging
            log.debug("Full stack trace for token generation failure:", e);
        }
        return null;
    }

    // Lazy initialization using ApplicationContext to break potential circular dependencies
    private LearnerOAuth2Manager getLearnerOAuth2Manager() {
        return applicationContext.getBean(LearnerOAuth2Manager.class);
    }

    private AdminOAuth2Manager getAdminOAuth2Manager() {
        return applicationContext.getBean(AdminOAuth2Manager.class);
    }
}