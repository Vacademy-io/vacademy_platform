package vacademy.io.admin_core_service.features.live_session.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionRegistrationPaymentResponseDTO;
import vacademy.io.admin_core_service.features.live_session.service.LiveSessionPaymentService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Authenticated learner payment endpoints for paid live sessions (private
 * sessions, or logged-in learners of public ones). Identity comes from the JWT;
 * the fee is settled through the same /pay/invoice flow as the guest path.
 */
@RestController
@RequestMapping("/admin-core-service/live-sessions/v1/payment")
public class LiveSessionPaymentController {

    @Autowired
    private LiveSessionPaymentService liveSessionPaymentService;

    /** Has this learner paid for the session (and is payment required at all)? */
    @GetMapping("/status")
    public ResponseEntity<LiveSessionRegistrationPaymentResponseDTO> getPaymentStatus(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("sessionId") String sessionId) {
        return ResponseEntity.ok(liveSessionPaymentService.getPaymentStatusForUser(sessionId, user.getUserId()));
    }

    /** Registers this learner for the paid session and raises/reuses the fee invoice. */
    @PostMapping("/register-and-pay")
    public ResponseEntity<LiveSessionRegistrationPaymentResponseDTO> registerAndPay(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("sessionId") String sessionId) {
        return ResponseEntity.ok(liveSessionPaymentService.registerAndInitiateForUser(sessionId, user.getUserId()));
    }
}
