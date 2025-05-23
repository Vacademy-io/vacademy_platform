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

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        String encodedState = request.getParameter("state");
        String redirectUrl = "https://dash.vacademy.io?error=true"; // fallback

        try {
            if (encodedState != null) {
                try {
                    String decodedJson = new String(Base64.getUrlDecoder().decode(encodedState), StandardCharsets.UTF_8);
                    JsonNode node = new ObjectMapper().readTree(decodedJson);
                    if (node.has("from")) {
                        redirectUrl = node.get("from").asText();
                    }
                } catch (Exception e) {
                    log.error("Failed to decode state", e);
                    e.printStackTrace();
                    response.sendRedirect(redirectUrl); // send error redirect
                    return;
                }
            }

            // 👉 Extract Google user info
            if (authentication instanceof OAuth2AuthenticationToken oauthToken) {
                try {
                    OAuth2User oauthUser = oauthToken.getPrincipal();
                    Map<String, Object> attributes = oauthUser.getAttributes();

                    String email = (String) attributes.get("email");
                    String name = (String) attributes.get("name");
                    String picture = (String) attributes.get("picture");

                    log.info("Logged in user: {} ({})", name, email);
                    log.info("Profile Picture: {}", picture);

                    JwtResponseDto jwtResponseDto = getTokenByClientUrlAndUserEmail(redirectUrl, email);
                    if (jwtResponseDto != null) {
                        String tokenizedRedirectUrl = String.format(
                                "%s?accessToken=%s&refreshToken=%s",
                                redirectUrl,
                                URLEncoder.encode(jwtResponseDto.getAccessToken(), StandardCharsets.UTF_8),
                                URLEncoder.encode(jwtResponseDto.getRefreshToken(), StandardCharsets.UTF_8)
                        );
                        response.sendRedirect(tokenizedRedirectUrl);
                        return;
                    } else {
                        log.error("JWT generation failed for email: {}", email);
                    }
                } catch (Exception e) {
                    log.error("Failed during OAuth2 user processing", e);
                    e.printStackTrace();
                }
            }

        } catch (Exception e) {
            log.error("Unexpected error during authentication success handling", e);
            e.printStackTrace();
        }

        // default fallback
        response.sendRedirect("https://dash.vacademy.io?error=true");
    }

    private JwtResponseDto getTokenByClientUrlAndUserEmail(String clientUrl, String email) {
        try {
            if (clientUrl.contains("learner")) {
                return learnerOAuth2Manager.loginUserByEmail(email);
            } else {
                return adminOAuth2Manager.loginUserByEmail(email);
            }
        } catch (Exception e) {
            log.error("Failed to generate token for user: {}", email, e);
            e.printStackTrace();
        }
        return null;
    }


}
