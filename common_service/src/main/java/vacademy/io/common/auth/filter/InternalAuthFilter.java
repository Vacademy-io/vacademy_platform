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

        if (request.getRequestURI().contains("internal")) {
                String clientName = request.getHeader("clientName");
                String clientToken = request.getHeader("Signature");


                boolean isValidClient = clientAuthenticationService.validateClient(clientName, clientToken);
                if (isValidClient) {
                    SecurityContextHolder.getContext().setAuthentication(new ClientAuthentication(clientName, clientToken));
                    filterChain.doFilter(request, response);
                } else {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.getWriter().write("Invalid client authentication");
                }
        } else {
            filterChain.doFilter(request, response);
            return;
        }
    }

}
