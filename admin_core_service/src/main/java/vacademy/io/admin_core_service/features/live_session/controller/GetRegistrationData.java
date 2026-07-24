package vacademy.io.admin_core_service.features.live_session.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.live_session.dto.GuestRegistrationRequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionRegistrationPaymentResponseDTO;
import vacademy.io.admin_core_service.features.live_session.dto.PaidLiveSessionRegistrationRequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.RegistrationFromResponseDTO;
import vacademy.io.admin_core_service.features.live_session.service.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/admin-core-service/live-session")
@RequiredArgsConstructor
public class GetRegistrationData {

    private final GetRegistrationDataService getRegistrationFromResponseDTO;

    @Autowired
    RegistrationService registrationService;

    @Autowired
    GetSessionByIdService getSessionByIdService;

    @Autowired
    LiveSessionPaymentService liveSessionPaymentService;

    @GetMapping("/get-registration-data")
    ResponseEntity<RegistrationFromResponseDTO> getRegistrationData(@RequestParam("sessionId") String SessionId) {
        return ResponseEntity.ok( getRegistrationFromResponseDTO.getRegistrationData(SessionId));
    }

    @PostMapping("/register-guest-user")
    ResponseEntity<String> registerGuestUser(@RequestBody GuestRegistrationRequestDTO requestDTO){
        return ResponseEntity.ok(registrationService.saveGuestUserDetails(requestDTO));
    }

    @GetMapping("/check-email-registration")
    public ResponseEntity<String> checkEmailRegistration(
            @RequestParam("email") String email,
            @RequestParam("sessionId") String sessionId
    ) {
        Optional<String> registrationId = getRegistrationFromResponseDTO.checkEmailRegistration(email, sessionId);
        return ResponseEntity.ok(registrationId.orElse(""));
    }


    @GetMapping("/get-earliest-schedule-id")
    ResponseEntity<String> getEarliestScheduleId(@RequestParam("sessionId") String sessionId){
        return ResponseEntity.ok(getSessionByIdService.findEarliestSchedule(sessionId));
    }

    // ── Paid live sessions (open endpoints — whitelisted in ApplicationSecurityConfig) ──

    /**
     * Registers the guest AND raises the fee invoice in one call. For free
     * sessions this behaves like /register-guest-user. The client settles the
     * returned invoice via the open /pay/invoice/{invoiceId} page.
     */
    @PostMapping("/register-and-pay")
    ResponseEntity<LiveSessionRegistrationPaymentResponseDTO> registerAndPay(
            @RequestBody PaidLiveSessionRegistrationRequestDTO requestDTO) {
        return ResponseEntity.ok(liveSessionPaymentService.registerAndInitiate(requestDTO, null));
    }

    /**
     * Payment requirement + this guest's registration/payment state for a
     * session, looked up by email and/or mobile number (phone-identity
     * institutes register without an email).
     */
    @GetMapping("/payment-info")
    ResponseEntity<LiveSessionRegistrationPaymentResponseDTO> getPaymentInfo(
            @RequestParam("sessionId") String sessionId,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "mobileNumber", required = false) String mobileNumber) {
        return ResponseEntity.ok(liveSessionPaymentService.getPaymentInfo(sessionId, email, mobileNumber));
    }
}
