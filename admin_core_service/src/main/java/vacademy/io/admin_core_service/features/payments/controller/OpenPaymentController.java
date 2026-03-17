package vacademy.io.admin_core_service.features.payments.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogDTO;
import vacademy.io.common.auth.dto.learner.UserWithJwtDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import lombok.extern.slf4j.Slf4j;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
public class OpenPaymentController {
    @Autowired
    private PaymentService paymentService;

    @Autowired
    private AuthService authService;

    @Autowired
    private PaymentLogService paymentLogService;

    @Autowired
    private PaymentLogRepository paymentLogRepository;

    @Autowired
    private UserPlanRepository userPlanRepository;

    @Autowired
    private EnrollInviteRepository enrollInviteRepository;

    @PostMapping("/admin-core-service/open/payments/pay")
    public ResponseEntity<PaymentResponseDTO> handleDonationPayment(
            @RequestBody PaymentInitiationRequestDTO request,
            @RequestParam String instituteId) {

        try {
            var response = paymentService.handlePayment(request, instituteId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            PaymentResponseDTO errorResponse = new PaymentResponseDTO();
            errorResponse.setStatus("FAILED");
            errorResponse.setMessage("Error processing donation payment: " + e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    @GetMapping("/admin-core-service/open/payments/{vendor}/status/{orderId}")
    public ResponseEntity<Map<String, Object>> checkPaymentStatus(
            @PathVariable String vendor,
            @PathVariable String orderId,
            @RequestParam(required = false) String instituteId,
            HttpServletRequest request,
            HttpServletResponse response) {

        return internalCheckPaymentStatus(vendor, orderId, instituteId, request, response);
    }

    // Support legacy path structure to avoid 403 Forbidden on frontend
    @GetMapping(value = "/admin-core-service/payments/user-plan/{vendor}/status/{orderId}")
    public ResponseEntity<Map<String, Object>> checkLegacyPaymentStatus(
            @PathVariable String vendor,
            @PathVariable String orderId,
            @RequestParam(required = false) String instituteId,
            HttpServletRequest request,
            HttpServletResponse response) {

        return internalCheckPaymentStatus(vendor, orderId, instituteId, request, response);
    }

    private ResponseEntity<Map<String, Object>> internalCheckPaymentStatus(
            String vendor,
            String orderId,
            String instituteId,
            HttpServletRequest request,
            HttpServletResponse response) {

        try {
            // Fallback for missing instituteId
            if (instituteId == null || instituteId.isEmpty() || "null".equalsIgnoreCase(instituteId)) {
                log.info("Missing instituteId for orderId: {}, attempting to resolve from PaymentLog", orderId);
                try {
                    Optional<PaymentLog> logOpt = paymentLogRepository.findById(orderId);
                    if (logOpt.isPresent()) {
                        UserPlan plan = logOpt.get().getUserPlan();
                        if (plan != null) {
                            String inviteId = plan.getEnrollInviteId();
                            if (inviteId != null) {
                                Optional<EnrollInvite> inviteOpt = enrollInviteRepository.findById(inviteId);
                                if (inviteOpt.isPresent()) {
                                    instituteId = inviteOpt.get().getInstituteId();
                                    log.info("Resolved instituteId: {} from EnrollInviteRepository using inviteId: {}",
                                            instituteId, inviteId);
                                }
                            }
                        } else {
                            // FALLBACK FOR DONATIONS: Try to get from paymentSpecificData
                            String paymentSpecificData = logOpt.get().getPaymentSpecificData();
                            if (paymentSpecificData != null) {
                                try {
                                    JsonNode root = JsonUtil.fromJson(paymentSpecificData, JsonNode.class);
                                    instituteId = root.path("originalRequest").path("instituteId").asText(null);
                                    if (instituteId != null) {
                                        log.info(
                                                "Resolved instituteId: {} from PaymentLog.paymentSpecificData for donation",
                                                instituteId);
                                    }
                                } catch (Exception e) {
                                    log.warn("Failed to parse paymentSpecificData for orderId: {}", orderId);
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    log.error("Failed to resolve instituteId from orderId: {} due to error: {}", orderId,
                            e.getMessage());
                }
            }

            if (instituteId == null || instituteId.isEmpty() || "null".equalsIgnoreCase(instituteId)) {
                return ResponseEntity.badRequest()
                        .body(java.util.Map.of("error", "instituteId is required and could not be resolved."));
            }

            java.util.Map<String, Object> status = paymentService.checkPaymentStatus(vendor, instituteId, orderId);

            return ResponseEntity.ok(status);
        } catch (UnsupportedOperationException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected error in checkPaymentStatus: ", e);
            return ResponseEntity.internalServerError().body(java.util.Map.of("error", e.getMessage()));
        }
    }
}
