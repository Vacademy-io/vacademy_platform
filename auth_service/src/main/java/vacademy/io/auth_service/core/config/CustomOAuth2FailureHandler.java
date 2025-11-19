package vacademy.io.auth_service.core.config;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class CustomOAuth2FailureHandler implements AuthenticationFailureHandler {
    private static final Logger log = LoggerFactory.getLogger(CustomOAuth2FailureHandler.class);

    @Value("${teacher.portal.client.url:https://dash.vacademy.io}")
    private String fallbackUrl;

    @Override
    public void onAuthenticationFailure(HttpServletRequest request,
                                        HttpServletResponse response,
                                        AuthenticationException exception) throws IOException, ServletException {
        
        log.error("OAuth2 authentication failed: {}", exception.getMessage(), exception);
        
        // Get the error parameter if present
        String error = request.getParameter("error");
        String errorDescription = request.getParameter("error_description");
        
        log.error("OAuth error: {}, description: {}", error, errorDescription);
        
        // Build redirect URL with error information
        String redirectUrl = fallbackUrl + "/login?oauth_error=" + 
                            URLEncoder.encode(exception.getMessage(), StandardCharsets.UTF_8);
        
        log.info("Redirecting to error page: {}", redirectUrl);
        response.sendRedirect(redirectUrl);
    }
}

