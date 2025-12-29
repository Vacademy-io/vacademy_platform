package vacademy.io.admin_core_service.features.learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.learner.dto.OpenLearnerEnrollRequestDTO;
import vacademy.io.admin_core_service.features.learner.service.LearnerEnrollRequestService;
import vacademy.io.admin_core_service.features.learner.service.OpenLearnerEnrollService;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollRequestDTO;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.common.auth.dto.learner.UserWithJwtDTO;
import org.springframework.http.ResponseCookie;
import org.springframework.http.HttpHeaders;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/admin-core-service/v1/learner/enroll")
public class LearnerEnrollRequestController {
    @Autowired
    private LearnerEnrollRequestService learnerEnrollRequestService;

    @Autowired
    private OpenLearnerEnrollService openLearnerEnrollService;

    @Autowired
    private AuthService authService;

    @PostMapping
    public ResponseEntity<LearnerEnrollResponseDTO> enrollLearner(
            @RequestBody LearnerEnrollRequestDTO learnerEnrollRequestDTO, HttpServletRequest request,
            HttpServletResponse response) {
        LearnerEnrollResponseDTO enrollResponse = learnerEnrollRequestService
                .recordLearnerRequest(learnerEnrollRequestDTO);

        if (enrollResponse != null && enrollResponse.getUser() != null) {
            try {
                UserWithJwtDTO tokens = authService.generateJwtTokensWithUser(enrollResponse.getUser().getId(),
                        learnerEnrollRequestDTO.getInstituteId());

                String host = request.getHeader("Host");
                boolean isLocalhost = host != null && (host.contains("localhost") || host.contains("127.0.0.1"));

                ResponseCookie.ResponseCookieBuilder accessCookieBuilder = ResponseCookie
                        .from("accessToken", tokens.getAccessToken())
                        .path("/")
                        .httpOnly(false)
                        .maxAge(3600 * 24)
                        .sameSite("Lax");

                ResponseCookie.ResponseCookieBuilder refreshCookieBuilder = ResponseCookie
                        .from("refreshToken", tokens.getRefreshToken())
                        .path("/")
                        .httpOnly(false)
                        .maxAge(86400 * 7)
                        .sameSite("Lax");

                if (isLocalhost) {
                    accessCookieBuilder.secure(false);
                    refreshCookieBuilder.secure(false);
                } else {
                    accessCookieBuilder.secure(true).domain(".vacademy.io");
                    refreshCookieBuilder.secure(true).domain(".vacademy.io");
                }

                response.addHeader(HttpHeaders.SET_COOKIE, accessCookieBuilder.build().toString());
                response.addHeader(HttpHeaders.SET_COOKIE, refreshCookieBuilder.build().toString());
            } catch (Exception e) {
                System.err.println("Auto-login cookie generation failed after enrollment: " + e.getMessage());
            }
        }

        return ResponseEntity.ok(enrollResponse);
    }

    @PostMapping("/detail")
    public ResponseEntity<String> enrollLearnerDetail(
            @RequestBody OpenLearnerEnrollRequestDTO openLearnerEnrollRequestDTO, String instituteId) {
        return ResponseEntity
                .ok(openLearnerEnrollService.enrollUserInPackageSession(openLearnerEnrollRequestDTO, instituteId));
    }
}
