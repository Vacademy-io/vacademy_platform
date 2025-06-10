package vacademy.io.auth_service.core.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.manager.AdminOAuth2Manager;
import vacademy.io.auth_service.feature.auth.manager.LearnerOAuth2Manager;
import vacademy.io.common.auth.entity.OAuth2VendorToUserDetail;
import vacademy.io.common.auth.service.OAuth2VendorToUserDetailService;
import vacademy.io.common.exceptions.VacademyException;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

@Component
public class CustomOAuth2SuccessHandler implements AuthenticationSuccessHandler {
    private static final Logger log = LoggerFactory.getLogger(CustomOAuth2SuccessHandler.class);

    @Autowired
    private LearnerOAuth2Manager learnerOAuth2Manager;

    @Autowired
    private AdminOAuth2Manager adminOAuth2Manager;

    @Autowired
    private OAuth2VendorToUserDetailService oAuth2VendorToUserDetailService;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        String encodedState = request.getParameter("state");
        String redirectUrl = "https://dash.vacademy.io"; // base fallback
        redirectUrl = decodeState(encodedState, redirectUrl, response);
        if (redirectUrl == null) return;

        if (!(authentication instanceof OAuth2AuthenticationToken oauthToken)) {
            log.error("Authentication is not OAuth2AuthenticationToken");
            sendErrorRedirect(response, redirectUrl, "invalid_authentication");
            return;
        }

        processOAuth2User(oauthToken, redirectUrl, response, encodedState);
    }

    private String decodeState(String encodedState, String fallbackUrl, HttpServletResponse response) throws IOException {
        if (encodedState == null) {
            return fallbackUrl;
        }
        try {
            String decodedJson = new String(Base64.getUrlDecoder().decode(encodedState), StandardCharsets.UTF_8);
            JsonNode node = new ObjectMapper().readTree(decodedJson);
            if (node.has("from")) {
                return node.get("from").asText();
            }
            return fallbackUrl;
        } catch (Exception e) {
            log.error("Failed to decode state", e);
            sendErrorRedirect(response, fallbackUrl, "failed_to_decode_state");
            return null;
        }
    }

    private void processOAuth2User(OAuth2AuthenticationToken oauthToken, String redirectUrl, HttpServletResponse response, String encodedState) throws IOException {
        try {
            OAuth2User oauthUser = oauthToken.getPrincipal();
            Map<String, Object> attributes = oauthUser.getAttributes();
            String provider = oauthToken.getAuthorizedClientRegistrationId();

            UserInfo userInfo = extractUserInfo(attributes, provider, response, redirectUrl);
            if (userInfo == null) return;

            // Handle sign-up logic differently
            if (redirectUrl.contains("signup")) {
                log.info("Signup flow detected. Skipping user creation. Sending profile data to frontend.");
                String email = userInfo.email;
                if (email == null){
                    email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId, userInfo.sub);
                }
                boolean isEmailVerified = (email!= null);
                String userJson = String.format(
                        "{\"name\":\"%s\", \"email\":\"%s\", \"profile\":\"%s\"}",
                        userInfo.name, email, userInfo.picture
                );
                String encodedUserInfo = Base64.getUrlEncoder().encodeToString(userJson.getBytes(StandardCharsets.UTF_8));

                String redirectWithParams = String.format(
                        "%s?signupData=%s&state=%s&emailVerified=%s",
                        redirectUrl,
                        URLEncoder.encode(encodedUserInfo, StandardCharsets.UTF_8),
                        URLEncoder.encode(encodedState != null ? encodedState : "", StandardCharsets.UTF_8),
                        URLEncoder.encode(String.valueOf(isEmailVerified),StandardCharsets.UTF_8)
                );
                response.sendRedirect(redirectWithParams);
                oAuth2VendorToUserDetailService.saveOrUpdateOAuth2VendorToUserDetail(userInfo.providerId, email, userInfo.sub);
                return;
            }
            String email = userInfo.email;
            if (email == null) {
                email = oAuth2VendorToUserDetailService.getEmailByProviderIdAndSubject(userInfo.providerId, userInfo.sub);
                if (email == null) {
                    throw new VacademyException("Your email ID is not public. Please verify your email with our app before using this feature.");
                }
            }
            // Else login as usual
            JwtResponseDto jwtResponseDto = getTokenByClientUrlAndUserEmail(redirectUrl, userInfo.name, email);
            if (jwtResponseDto != null) {
                redirectWithTokens(response, redirectUrl, jwtResponseDto);
            } else {
                log.error("JWT generation failed for email: {}", email);
                throw new VacademyException("Error occurred during JWT generation");
            }
        } catch (Exception e) {
            log.error("Failed during OAuth2 user processing", e);
            sendErrorRedirect(response, redirectUrl, e.getMessage());
        }
    }


    private UserInfo extractUserInfo(Map<String, Object> attributes, String provider, HttpServletResponse response, String redirectUrl) throws IOException {
        String email = null;
        String name = null;
        String picture = null;
        String sub = null;           // unique user ID
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
        return new UserInfo(email, name, picture, providerId, sub);
    }

    private record UserInfo(String email, String name, String picture, String providerId, String sub) {}


    private void redirectWithTokens(HttpServletResponse response, String redirectUrl, JwtResponseDto jwtResponseDto) throws IOException {
        String tokenizedRedirectUrl = String.format(
                "%s?accessToken=%s&refreshToken=%s",
                redirectUrl,
                URLEncoder.encode(jwtResponseDto.getAccessToken(), StandardCharsets.UTF_8),
                URLEncoder.encode(jwtResponseDto.getRefreshToken(), StandardCharsets.UTF_8)
        );
        response.sendRedirect(tokenizedRedirectUrl);
    }

    private void sendErrorRedirect(HttpServletResponse response, String baseUrl, String errorMessage) throws IOException {
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


    private JwtResponseDto getTokenByClientUrlAndUserEmail(String clientUrl, String fullName, String email) {
        try {
            if (clientUrl.contains("learner")) {
                return learnerOAuth2Manager.loginUserByEmail(email);
            } else {
                if (clientUrl.contains("signup")) {
                    // No user creation during signup flow
                    return null;
                }
                return adminOAuth2Manager.loginUserByEmail(email);
            }
        } catch (Exception e) {
            log.error("Failed to generate token for user: {}", email, e);
        }
        return null;
    }
}
