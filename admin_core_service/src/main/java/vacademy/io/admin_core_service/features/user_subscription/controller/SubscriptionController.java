package vacademy.io.admin_core_service.features.user_subscription.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
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
}
