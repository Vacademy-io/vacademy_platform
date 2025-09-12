package vacademy.io.auth_service.feature.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.stereotype.Service;

@Service
public class OAuth2TokenService {

    private static final Logger log = LoggerFactory.getLogger(OAuth2TokenService.class);

    @Autowired
    @Lazy
    private OAuth2AuthorizedClientService authorizedClientService;

    /**
     * Extracts the access token from OAuth2AuthenticationToken
     * @param oauthToken OAuth2 authentication token
     * @return Access token string or null if not found
     */
    public String getAccessToken(OAuth2AuthenticationToken oauthToken) {
        try {
            String clientRegistrationId = oauthToken.getAuthorizedClientRegistrationId();
            String principalName = oauthToken.getName();
            
            log.debug("Getting access token for client: {} and principal: {}", clientRegistrationId, principalName);
            
            OAuth2AuthorizedClient authorizedClient = authorizedClientService
                    .loadAuthorizedClient(clientRegistrationId, principalName);
            
            if (authorizedClient != null) {
                OAuth2AccessToken accessToken = authorizedClient.getAccessToken();
                if (accessToken != null) {
                    String tokenValue = accessToken.getTokenValue();
                    log.debug("Successfully retrieved access token");
                    return tokenValue;
                } else {
                    log.warn("Access token is null for client: {} and principal: {}", clientRegistrationId, principalName);
                }
            } else {
                log.warn("No authorized client found for client: {} and principal: {}", clientRegistrationId, principalName);
            }
        } catch (Exception e) {
            log.error("Error retrieving access token", e);
        }
        
        return null;
    }

    /**
     * Checks if the access token is valid and not expired
     * @param oauthToken OAuth2 authentication token
     * @return true if token is valid, false otherwise
     */
    public boolean isTokenValid(OAuth2AuthenticationToken oauthToken) {
        try {
            String accessToken = getAccessToken(oauthToken);
            return accessToken != null && !accessToken.trim().isEmpty();
        } catch (Exception e) {
            log.error("Error checking token validity", e);
            return false;
        }
    }
}
