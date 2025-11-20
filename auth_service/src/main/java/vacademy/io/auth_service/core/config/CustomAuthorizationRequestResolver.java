package vacademy.io.auth_service.core.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import java.util.function.Consumer;

public class CustomAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    private final OAuth2AuthorizationRequestResolver defaultResolver;

    public CustomAuthorizationRequestResolver(ClientRegistrationRepository repo, String baseUri) {
        DefaultOAuth2AuthorizationRequestResolver resolver = new DefaultOAuth2AuthorizationRequestResolver(repo, baseUri);
        resolver.setAuthorizationRequestCustomizer(this::customizeAuthorizationRequest);
        this.defaultResolver = resolver;
    }
    
    private void customizeAuthorizationRequest(OAuth2AuthorizationRequest.Builder builder) {
        // Any additional customization can go here
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        OAuth2AuthorizationRequest req = defaultResolver.resolve(request);
        return customizeState(request, req);
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        OAuth2AuthorizationRequest req = defaultResolver.resolve(request, clientRegistrationId);
        return customizeState(request, req);
    }

    private OAuth2AuthorizationRequest customizeState(HttpServletRequest request, OAuth2AuthorizationRequest req) {
        if (req == null) return null;
        String customState = request.getParameter("state");
        if (customState != null) {
            return OAuth2AuthorizationRequest.from(req)
                    .state(customState)
                    .build();
        }
        return req;
    }
}
