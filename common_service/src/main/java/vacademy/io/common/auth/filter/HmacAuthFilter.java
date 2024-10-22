package vacademy.io.common.auth.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import vacademy.io.common.auth.utils.HmacUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Objects;

@Slf4j
@Component
public class HmacAuthFilter extends OncePerRequestFilter {

    private static final String[] FILTER_ALLOWED_PATHS = {"/auth/internal", "/media/internal", "/payment/internal", "/user/internal"};
    @Autowired
    HmacUtils hmacUtils;

    private static boolean startsWithAllowedPath(String request) {
        for (String path : FILTER_ALLOWED_PATHS) {
            if (request.startsWith(path)) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String requestURI = request.getRequestURI();
        if (!startsWithAllowedPath(requestURI)) {
            filterChain.doFilter(request, response);
            return;
        }
        // Extract headers: Signature, API-Key, timestamp
        String signature = request.getHeader("signature");
        String clientName = request.getHeader("clientName");

        // Retrieve the secret key from the database based on the client name
        String secretKey = hmacUtils.retrieveSecretKeyFromDatabase(clientName);

        if (secretKey == null) {
            // Invalid client name, reject the request
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        // Calculate HMAC signature using request data and the retrieved secret key
        String calculatedSignature = HmacUtils.calculateHmacSignature(request, secretKey);
        log.error("Calculated Signature: " + calculatedSignature);
        // Compare client's signature with server-generated signature
        if (Objects.equals(calculatedSignature, signature)) {
            // Valid request, proceed with processing
            filterChain.doFilter(request, response);
        } else {
            // Invalid request, reject
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        }
    }

}
