package vacademy.io.admin_core_service.features.user_subscription.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.plan_change.dto.PlanChangeOptionsDTO;
import vacademy.io.admin_core_service.features.plan_change.dto.PlanChangeRequestDTO;
import vacademy.io.admin_core_service.features.plan_change.dto.PlanChangeResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.SubscriptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.SubscriptionService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Learner self-service for subscriptions + autopay mandates. User id always
 * comes from the JWT, never the request. Drives the course-details cancel
 * button, the profile remove-mandate row, and the student-view cancel flow.
 */
@RestController
@RequestMapping("/admin-core-service/learner/subscription/v1")
@RequiredArgsConstructor
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    /** List the learner's subscriptions (with autopay/mandate status). */
    @GetMapping
    public ResponseEntity<List<SubscriptionDTO>> list(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String instituteId) {
        return ResponseEntity.ok(subscriptionService.listSubscriptions(user.getUserId(), instituteId));
    }

    /**
     * Start a manual renewal payment for the learner's own plan ("pay to
     * continue"). Amount and vendor are derived server-side from the plan.
     * withAutopay=true (only when the invite has autopay enabled) opens the
     * checkout in mandate mode so the payment also re-registers auto-pay.
     */
    @PostMapping("/{userPlanId}/renew-payment")
    public ResponseEntity<vacademy.io.common.payment.dto.PaymentResponseDTO> renewPayment(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String userPlanId,
            @RequestParam(defaultValue = "false") boolean withAutopay) {
        return ResponseEntity.ok(
                subscriptionService.initiateRenewalPayment(user, instituteId, userPlanId, withAutopay));
    }

    /**
     * Cancel autopay for one subscription. Revokes the mandate and stops future
     * charges; access is retained until end_date.
     */
    @PostMapping("/{userPlanId}/cancel")
    public ResponseEntity<SubscriptionDTO> cancel(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String userPlanId) {
        return ResponseEntity.ok(
                subscriptionService.cancelSubscription(user.getUserId(), instituteId, userPlanId));
    }

    /**
     * The plans this learner may switch to, each already priced for them right now — the
     * prorated amount due, or the date a free downgrade would take effect. Also reports any
     * change already booked.
     */
    @GetMapping("/{userPlanId}/change-options")
    public ResponseEntity<PlanChangeOptionsDTO> changeOptions(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String userPlanId) {
        return ResponseEntity.ok(
                subscriptionService.getPlanChangeOptions(user, instituteId, userPlanId));
    }

    /**
     * Switch to another plan. An upgrade returns a gateway checkout for the prorated
     * difference and lands when the payment clears; a downgrade is booked for the end of the
     * paid cycle and costs nothing. The client branches on {@code status} rather than
     * guessing from which fields are present.
     *
     * <p>Amount and target eligibility are always derived server-side — the body carries a
     * plan id, never a price.
     */
    @PostMapping("/{userPlanId}/change-plan")
    public ResponseEntity<PlanChangeResponseDTO> changePlan(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String userPlanId,
            @RequestBody PlanChangeRequestDTO request) {
        return ResponseEntity.ok(
                subscriptionService.requestPlanChange(user, instituteId, userPlanId, request));
    }

    /** Call off a downgrade booked for the end of the cycle. */
    @DeleteMapping("/{userPlanId}/change-plan")
    public ResponseEntity<Void> cancelScheduledPlanChange(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String userPlanId) {
        subscriptionService.cancelScheduledPlanChange(user, instituteId, userPlanId);
        return ResponseEntity.noContent().build();
    }
}
