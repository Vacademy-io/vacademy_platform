package vacademy.io.auth_service.core.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.manager.AdminOAuth2Manager;
import vacademy.io.auth_service.feature.auth.manager.LearnerOAuth2Manager;
import vacademy.io.auth_service.feature.admin_core_service.dto.InstituteSignupPolicy;
import vacademy.io.auth_service.feature.admin_core_service.service.InstitutePolicyService;
import vacademy.io.common.auth.service.OAuth2VendorToUserDetailService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLDecoder;
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
    private InstitutePolicyService institutePolicyService;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) throws IOException {

        String encodedState = request.getParameter("state");
        String redirectUrl = "https://dash.vacademy.io"; // base fallback
        redirectUrl = decodeState(encodedState, redirectUrl, response);
        if (redirectUrl == null)
            return;

        if (!(authentication instanceof OAuth2AuthenticationToken oauthToken)) {
            log.error("Authentication is not OAuth2AuthenticationToken");
            sendErrorRedirect(response, redirectUrl, "invalid_authentication");
            return;
        }

        processOAuth2User(oauthToken, redirectUrl, response, encodedState);
    }

    private String decodeState(String encodedState, String fallbackUrl, HttpServletResponse response) throws IOException {
        if (encodedState == null || encodedState.trim().isEmpty()) {
            return fallbackUrl;
        }
        try {
            // Decode the URL-encoded state
            String decodedState = URLDecoder.decode(encodedState, StandardCharsets.UTF_8);

            // If it's a plain URL
            if (decodedState.startsWith("http")) {
                return decodedState;
            }
            System.out.println(decodedState);
            // Try parsing as JSON to extract "from"
            ObjectMapper mapper = new ObjectMapper();
            JsonNode stateNode = mapper.readTree(decodedState);

            if (stateNode.has("from")) {
                String fromUrl = stateNode.get("from").asText();
                if (fromUrl != null && fromUrl.startsWith("http")) {
                    return fromUrl;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to decode or parse state parameter: {}", encodedState, e);
        }
        return fallbackUrl;
    }

    private void processOAuth2User(OAuth2AuthenticationToken oauthToken, String redirectUrl,
            HttpServletResponse response, String encodedState) throws IOException {
        try {
            OAuth2User oauthUser = oauthToken.getPrincipal();
            Map<String, Object> attributes = oauthUser.getAttributes();
            String provider = oauthToken.getAuthorizedClientRegistrationId();

            UserInfo userInfo = extractUserInfo(attributes, provider, response, redirectUrl);
            if (userInfo == null)
                return;

            String email = userInfo.email;
            if (email == null) {
                email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId,
                        userInfo.sub);
            }
            boolean isEmailVerified = (email != null);

            // Handle sign-up logic differently
            if (redirectUrl.contains("signup")) {
                handleSignupFlow(userInfo, redirectUrl, response, encodedState, isEmailVerified);
                return;
            }

            // Handle login flow
            handleLoginFlow(userInfo, redirectUrl, response, encodedState, isEmailVerified);

        } catch (Exception e) {
            log.error("Failed during OAuth2 user processing", e);
            sendErrorRedirect(response, redirectUrl, e.getMessage());
        }
    }

    private void handleSignupFlow(UserInfo userInfo, String redirectUrl, HttpServletResponse response,
            String encodedState, boolean isEmailVerified) throws IOException {
        String email = userInfo.email;
        if (email == null) {
            email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId, userInfo.sub);
        }

        // For signup, always return user data to frontend
       if (!redirectUrl.contains("learner")) {
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
       }else {
           JwtResponseDto jwtResponseDto = getTokenByClientUrlAndUserEmail(redirectUrl, userInfo.name, email,
                   userInfo.instituteId);
          if (jwtResponseDto != null) {
              // User found, return token in URL
              redirectWithTokens(response, redirectUrl, jwtResponseDto);
              return;
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
       }
    }

    private void handleLoginFlow(UserInfo userInfo, String redirectUrl, HttpServletResponse response,
            String encodedState, boolean isEmailVerified) throws IOException {
        String email = userInfo.email;
        if (email == null) {
            email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId, userInfo.sub);
        }

        // First try to login the user by email
        JwtResponseDto jwtResponseDto = getTokenByClientUrlAndUserEmail(redirectUrl, userInfo.name, email,
                userInfo.instituteId);

        if (jwtResponseDto != null) {
            // User found, return token in URL
            redirectWithTokens(response, redirectUrl, jwtResponseDto);
            return;
        }
        if(redirectUrl.contains("learner")) {
            if (userInfo.instituteId != null) {
                InstituteSignupPolicy signupPolicy = institutePolicyService.fetchSignupPolicy(userInfo.instituteId);

                if (signupPolicy != null) {
                    if ("manual".equalsIgnoreCase(signupPolicy.getPasswordStrategy())) {
                        // Manual password strategy - return user data to frontend with error
                        returnUserDataToFrontend(response, redirectUrl, userInfo, encodedState, isEmailVerified, true);
                        return;
                    } else {
                        // Auto password strategy - create user and return token
                        try {
                            if (redirectUrl.contains("learner")) {
                                jwtResponseDto = getLearnerOAuth2Manager().createUserAndLogin(userInfo.name, email,
                                        userInfo.instituteId);
                            } else {
                                jwtResponseDto = getAdminOAuth2Manager().createUserAndLogin(userInfo.name, email);
                            }

                            if (jwtResponseDto != null) {
                                redirectWithTokens(response, redirectUrl, jwtResponseDto);
                                return;
                            }
                        } catch (Exception e) {
                            log.error("Failed to create user during OAuth2 login", e);
                            returnUserDataToFrontend(response, redirectUrl, userInfo, encodedState, isEmailVerified, true);
                            return;
                        }
                    }
                } else {
                    // Institute policy not found - don't create user, return data to frontend
                    returnUserDataToFrontend(response, redirectUrl, userInfo, encodedState, isEmailVerified, true);
                    return;
                }
            } else {
                // No institute ID - return user data to frontend
                returnUserDataToFrontend(response, redirectUrl, userInfo, encodedState, isEmailVerified, true);
                return;
            }
        }


        // Fallback - return user data to frontend with error
        returnUserDataToFrontend(response, redirectUrl, userInfo, encodedState, isEmailVerified, true);
    }

    private void returnUserDataToFrontend(HttpServletResponse response, String redirectUrl, UserInfo userInfo,
            String encodedState, boolean isEmailVerified, boolean hasError) throws IOException {
        String email = userInfo.email;
        if (email == null) {
            email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId, userInfo.sub);
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
        response.sendRedirect(redirectWithParams);
    }

    private UserInfo extractUserInfo(Map<String, Object> attributes, String provider, HttpServletResponse response,
            String redirectUrl) throws IOException {
        String email = null;
        String name = null;
        String picture = null;
        String sub = null; // unique user ID
        String providerId = provider; // provider name: "google", "github", etc.
        String instituteId = null;

        if ("google".equals(provider)) {
            email = (String) attributes.get("email");
            name = (String) attributes.get("name");
            picture = (String) attributes.get("picture");
            sub = (String) attributes.get("sub"); // Google's unique user ID
            instituteId = (String) attributes.get("instituteId");
            log.info("Google user logged in: {} ({})", name, email);
        } else if ("github".equals(provider)) {
            email = (String) attributes.get("email");
            name = (String) attributes.get("name");
            if (name == null) {
                name = (String) attributes.get("login");
            }
            picture = (String) attributes.get("avatar_url");
            sub = String.valueOf(attributes.get("id")); // GitHub's unique user ID
            instituteId = (String) attributes.get("instituteId");
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

    private JwtResponseDto getTokenByClientUrlAndUserEmail(String clientUrl, String fullName, String email,
            String instituteId) {
        try {
            if (clientUrl.contains("learner")) {
                return getLearnerOAuth2Manager().loginUserByEmail(fullName, email, instituteId);
            } else {
                return getAdminOAuth2Manager().loginUserByEmail(email);
            }
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
}
