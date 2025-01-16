package vacademy.io.assessment_service.core.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import vacademy.io.common.auth.entity.UserActivity;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserActivityRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.exceptions.ExpiredTokenException;
import vacademy.io.common.exceptions.InvalidTokenException;

import java.io.IOException;

@Component
@Slf4j
public class AssessmentJwtAuthFilter extends OncePerRequestFilter {

    @Autowired
    UserDetailsService userDetailsService;

    @Autowired
    private UserActivityRepository userActivityRepository;
    @Autowired
    private JwtService jwtService; // Inject JwtService dependency

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        // Retrieve Authorization header from the request

        final String authHeader = request.getHeader("Authorization");
        final String instituteId = request.getHeader("clientId");

        // If header is missing or doesn't start with "Bearer ", skip filter
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            // Extract JWT token from the header (remove "Bearer ")
            final String jwt = authHeader.substring(7);

            // Extract user email from the JWT using JwtService
            final String usernameWithInstituteId = instituteId + "@" + jwtService.extractUsername(jwt);

            // Get current authentication object from SecurityContextHolder
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

            // If user email is present and no authentication exists
            if (usernameWithInstituteId != null && authentication == null) {

                boolean isTokenExpired = jwtService.isTokenExpired(jwt);
                if (isTokenExpired) throw new ExpiredTokenException("Expired Token");
                // Load user details using user email
                CustomUserDetails userDetails = (CustomUserDetails) userDetailsService.loadUserByUsername(usernameWithInstituteId);

                // Pass User ID with request
                request.setAttribute("user", userDetails);


                // Validate the JWT token using user details and JwtService
                if (jwtService.isTokenValid(jwt, userDetails)) {
                    // Create an authentication token with user details and authorities

                    // todo use loadUserByUsername from assessmentInternalUserDetailsService

                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(userDetails, null, // As JWT based, no password needed
                            userDetails.getAuthorities());

                    // Set request details on the token
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    // Set the authentication object in SecurityContextHolder
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }

            // Proceed with the filter chain (other filters and request handling)
            filterChain.doFilter(request, response);
        } catch (Exception exception) {
            // Log any errors during JWT processing
            log.error(exception.getMessage());
            throw new InvalidTokenException("Invalid Token");
        }
    }


    void addUserActivity(String userId, String origin, String route, String clientIp) {
        try {
            UserActivity userActivity = new UserActivity();
            userActivity.setUserId(userId);
            userActivity.setOrigin(origin);
            userActivity.setRoute(route);
            userActivity.setClientIp(clientIp);
            userActivityRepository.save(userActivity);
        } catch (Exception e) {
            log.error(e.getMessage());
        }
    }

}

