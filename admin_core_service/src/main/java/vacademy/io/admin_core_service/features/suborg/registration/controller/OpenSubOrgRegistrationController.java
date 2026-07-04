package vacademy.io.admin_core_service.features.suborg.registration.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.CompleteRegistrationRequestDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.CompleteRegistrationResponseDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.PublicTemplateDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.ResendOtpRequestDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.StartRegistrationRequestDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.StartRegistrationResponseDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.VerifyOtpRequestDTO;
import vacademy.io.admin_core_service.features.suborg.registration.service.SubOrgRegistrationService;

import java.util.Map;

/**
 * PUBLIC endpoints for the open sub-org self-registration wizard.
 * Whitelisted via the existing /admin-core-service/open/** rule — no auth.
 * OTP verification is enforced server-side in SubOrgRegistrationService.
 */
@RestController
@RequestMapping("/admin-core-service/open/v1/sub-org-registration")
@RequiredArgsConstructor
@Tag(name = "Open Sub-Org Registration", description = "Public self-registration flow")
public class OpenSubOrgRegistrationController {

    private final SubOrgRegistrationService registrationService;
    private final vacademy.io.admin_core_service.features.suborg.registration.service.SubOrgRegistrationKycService kycService;

    @GetMapping("/template")
    public ResponseEntity<PublicTemplateDTO> getTemplate(
            @RequestParam("instituteId") String instituteId,
            @RequestParam("code") String code) {
        return ResponseEntity.ok(registrationService.getTemplate(instituteId, code));
    }

    @PostMapping("/start")
    public ResponseEntity<StartRegistrationResponseDTO> start(
            @RequestBody StartRegistrationRequestDTO request) {
        return ResponseEntity.ok(registrationService.start(request));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<StartRegistrationResponseDTO> verifyOtp(
            @RequestBody VerifyOtpRequestDTO request) {
        return ResponseEntity.ok(
                registrationService.verifyOtp(request.getRegistrationId(), request.getOtp()));
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<Map<String, String>> resendOtp(
            @RequestBody ResendOtpRequestDTO request) {
        registrationService.resendOtp(request.getRegistrationId());
        return ResponseEntity.ok(Map.of("status", "SENT"));
    }

    @PostMapping("/complete")
    public ResponseEntity<CompleteRegistrationResponseDTO> complete(
            @RequestBody CompleteRegistrationRequestDTO request) {
        return ResponseEntity.ok(registrationService.complete(request));
    }

    // ---- DigiLocker KYC (Cashfree SecureID) ----

    @PostMapping("/kyc/start")
    public ResponseEntity<SubOrgRegistrationFlowDTOs.StartKycResponseDTO> startKyc(
            @RequestBody SubOrgRegistrationFlowDTOs.StartKycRequestDTO request) {
        return ResponseEntity.ok(
                kycService.startKyc(request.getRegistrationId(), request.getRedirectUrl()));
    }

    @GetMapping("/kyc/status")
    public ResponseEntity<SubOrgRegistrationFlowDTOs.KycStatusResponseDTO> kycStatus(
            @RequestParam("registrationId") String registrationId) {
        return ResponseEntity.ok(kycService.getKycStatus(registrationId));
    }

    /**
     * Cashfree SecureID webhook (register in Merchant Dashboard → Developers → Webhooks).
     * Raw body is required for signature verification — do not bind to a DTO.
     */
    @PostMapping("/kyc/webhook")
    public ResponseEntity<String> kycWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "x-webhook-signature", required = false) String signature,
            @RequestHeader(value = "x-webhook-timestamp", required = false) String timestamp) {
        try {
            kycService.handleWebhook(payload, signature, timestamp);
            return ResponseEntity.ok("OK");
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Invalid signature");
        }
    }
}
