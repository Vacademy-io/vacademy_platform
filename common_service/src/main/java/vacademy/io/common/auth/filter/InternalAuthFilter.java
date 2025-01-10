package vacademy.io.common.auth.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import vacademy.io.common.auth.service.ClientAuthentication;
import vacademy.io.common.auth.service.ClientAuthenticationService;

import java.io.IOException;
import java.util.Base64;
import java.util.StringTokenizer;

@Component
public class InternalAuthFilter extends OncePerRequestFilter {

    @Autowired
    private ClientAuthenticationService clientAuthenticationService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (request.getRequestURI().startsWith("/internal/")) {
            String authorizationHeader = request.getHeader("Authorization");

            if (authorizationHeader != null && authorizationHeader.startsWith("Basic ")) {
                String base64Credentials = authorizationHeader.substring("Basic ".length());
                String credentials = new String(Base64.getDecoder().decode(base64Credentials));
                StringTokenizer tokenizer = new StringTokenizer(credentials, ":");
                String clientName = tokenizer.nextToken();
                String clientToken = tokenizer.nextToken();


                boolean isValidClient = clientAuthenticationService.validateClient(clientName, clientToken);

                if (isValidClient) {
                    SecurityContextHolder.getContext().setAuthentication(new ClientAuthentication(clientName, clientToken));
                    filterChain.doFilter(request, response);
                } else {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.getWriter().write("Invalid client authentication");
                }
            } else {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                response.getWriter().write("Authorization header missing or invalid");
            }
        } else {
            filterChain.doFilter(request, response);
            return;
        }
    }

}
