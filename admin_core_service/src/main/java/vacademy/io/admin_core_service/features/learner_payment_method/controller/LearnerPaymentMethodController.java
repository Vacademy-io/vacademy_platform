package vacademy.io.admin_core_service.features.learner_payment_method.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_payment_method.dto.LearnerBillingDetailsDTO;
import vacademy.io.admin_core_service.features.learner_payment_method.dto.LearnerCardUpdateRequestDTO;
import vacademy.io.admin_core_service.features.learner_payment_method.dto.LearnerPaymentMethodSummaryDTO;
import vacademy.io.admin_core_service.features.learner_payment_method.dto.StripeSetupIntentResponseDTO;
import vacademy.io.admin_core_service.features.learner_payment_method.service.LearnerPaymentMethodService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Learner self-service for the saved payment method charged by auto-renewal.
 * All operations are scoped to the authenticated learner's own gateway
 * customer mapping — the user id always comes from the JWT, never the request.
 */
@RestController
@RequestMapping("/admin-core-service/learner/payment-method/v1")
public class LearnerPaymentMethodController {

    @Autowired
    private LearnerPaymentMethodService learnerPaymentMethodService;

    @GetMapping("/summary")
    public ResponseEntity<LearnerPaymentMethodSummaryDTO> getSummary(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String instituteId) {
        return ResponseEntity.ok(learnerPaymentMethodService.getSummary(user.getUserId(), instituteId));
    }

    @PostMapping("/stripe/setup-intent")
    public ResponseEntity<StripeSetupIntentResponseDTO> createStripeSetupIntent(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String instituteId) {
        return ResponseEntity.ok(learnerPaymentMethodService.createStripeSetupIntent(user.getUserId(), instituteId));
    }

    @PostMapping("/confirm-card-update")
    public ResponseEntity<LearnerPaymentMethodSummaryDTO> confirmCardUpdate(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String instituteId,
            @RequestBody LearnerCardUpdateRequestDTO request) {
        return ResponseEntity
                .ok(learnerPaymentMethodService.confirmCardUpdate(user.getUserId(), instituteId, request));
    }

    @PutMapping("/billing-details")
    public ResponseEntity<LearnerPaymentMethodSummaryDTO> updateBillingDetails(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String instituteId,
            @RequestBody LearnerBillingDetailsDTO request) {
        return ResponseEntity
                .ok(learnerPaymentMethodService.updateBillingDetails(user.getUserId(), instituteId, request));
    }
}
