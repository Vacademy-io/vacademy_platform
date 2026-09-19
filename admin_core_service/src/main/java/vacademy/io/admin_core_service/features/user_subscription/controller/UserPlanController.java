package vacademy.io.admin_core_service.features.user_subscription.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import java.util.List;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.plan_change.dto.PlanChangeOptionsDTO;
import vacademy.io.admin_core_service.features.plan_change.dto.PlanChangeRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.*;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/v1/user-plan")
public class UserPlanController {

    @Autowired
    private UserPlanService userPlanService;

    @Autowired
    private PaymentLogService paymentLogService;

    @GetMapping("/{userPlanId}/with-payment-logs")
    public ResponseEntity<UserPlanDTO> getUserPlanWithPaymentLogs(
            @PathVariable String userPlanId,
            @RequestParam(required = false, defaultValue = "false") boolean includePolicyDetails,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        UserPlanDTO userPlanDTO = userPlanService.getUserPlanWithPaymentLogs(userPlanId, includePolicyDetails);
        return ResponseEntity.ok(userPlanDTO);
    }

    @PostMapping("/all")
    public ResponseEntity<Page<UserPlanDTO>> getUserPlans(
            @RequestParam(required = false, defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(required = false, defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize,
            @RequestBody UserPlanFilterDTO filterDTO) {

        Page<UserPlanDTO> userPlans = userPlanService.getUserPlansByUserIdAndInstituteId(pageNo, pageSize, filterDTO);
        return ResponseEntity.ok(userPlans);
    }

    @PostMapping("/payment-logs")
    public ResponseEntity<Page<PaymentLogWithUserPlanDTO>> getPaymentLogs(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam(required = false, defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(required = false, defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize,
            @RequestBody PaymentLogFilterRequestDTO filterDTO) {

        Page<PaymentLogWithUserPlanDTO> paymentLogs = paymentLogService
                .getPaymentLogsForInstitute(filterDTO, pageNo, pageSize);
        return ResponseEntity.ok(paymentLogs);
    }

    /**
     * Aggregated PAID collection total + per-day series for an institute, optionally
     * scoped to one sub-org, over a UTC date window. Powers the dashboard "amount
     * collected (last 3/7/24 days / all)" panels. Omit dates for all-time.
     */
    @PostMapping("/payment-logs/collection-summary")
    public ResponseEntity<CollectionSummaryResponseDTO> getCollectionSummary(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody CollectionSummaryRequestDTO request) {
        return ResponseEntity.ok(paymentLogService.getCollectionSummary(request));
    }

    /**
     * Total billed / collected / due for an institute over a window, computed from the plans
     * learners are enrolled on rather than from payment rows — so a part-paid instalment plan and
     * an enrolment that has never paid both show up as money owed. Omit dates for all-time.
     */
    @PostMapping("/payment-logs/billing-summary")
    public ResponseEntity<BillingSummaryResponseDTO> getBillingSummary(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody BillingSummaryRequestDTO request) {
        return ResponseEntity.ok(paymentLogService.getBillingSummary(request));
    }

    /**
     * Paginated drill-down behind the "Due payment" card: the learners who still owe money, with
     * the amount, the fee type, and (for custom instalment plans) their next instalment.
     */
    @PostMapping("/payment-logs/outstanding-learners")
    public ResponseEntity<Page<OutstandingLearnerDTO>> getOutstandingLearners(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody BillingSummaryRequestDTO request,
            @RequestParam(value = "pageNo", defaultValue = "0") int pageNo,
            @RequestParam(value = "pageSize", defaultValue = "20") int pageSize) {
        return ResponseEntity.ok(paymentLogService.getOutstandingLearners(request, pageNo, pageSize));
    }

    /**
     * The enrolments behind one learner's Due row — the side view. Returns cancelled plans too,
     * flagged, so an admin can verify a cancellation actually removed the balance.
     */
    @PostMapping("/payment-logs/learner-plan-breakdown")
    public ResponseEntity<List<LearnerPlanBreakdownDTO>> getLearnerPlanBreakdown(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody BillingSummaryRequestDTO request,
            @RequestParam("userId") String userId) {
        return ResponseEntity.ok(paymentLogService.getLearnerPlanBreakdown(request, userId));
    }

    @PostMapping("/payment-logs/update-tracking")
    public ResponseEntity<Void> updatePaymentLogTracking(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody UpdatePaymentLogTrackingDTO trackingDTO) {

        paymentLogService.updatePaymentLogTracking(trackingDTO);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/status")
    public ResponseEntity<Void> updateUserPlanStatuses(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody UserPlanStatusUpdateRequestDTO request) {

        userPlanService.updateUserPlanStatuses(request.getUserPlanIds(), request.getStatus());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{userPlanId}/cancel")
    public ResponseEntity<Void> cancelUserPlan(
            @PathVariable String userPlanId,
            @RequestParam(required = false, defaultValue = "false") boolean force,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        userPlanService.cancelUserPlan(userPlanId, force);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/membership-details")
    public ResponseEntity<Page<MembershipDetailsDTO>> getMembershipDetails(
            @RequestParam(required = false, defaultValue = "0") int pageNo,
            @RequestParam(required = false, defaultValue = "10") int pageSize,
            @RequestBody MembershipFilterDTO filterDTO,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        // Ensure institute ID is set (security check could be added here to ensure user
        // belongs to institute)
        if (filterDTO.getInstituteId() == null) {
            // Fallback or Error depending on logic, assuming usually passed in body or
            // derived
        }

        return ResponseEntity
                .ok(userPlanService.getMembershipDetails(filterDTO, pageNo, pageSize));
    }

    /**
     * The plans this learner could be moved to, with the proration figures shown for
     * information. Same eligibility rules as the learner-facing listing — an admin cannot
     * move someone onto a plan the institute has not flagged as switchable.
     */
    @GetMapping("/{userPlanId}/change-options")
    public ResponseEntity<PlanChangeOptionsDTO> getPlanChangeOptions(
            @PathVariable String userPlanId,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        return ResponseEntity.ok(userPlanService.getPlanChangeOptions(userPlanId, instituteId));
    }

    /**
     * Admin override: move the learner onto another plan immediately, with no payment.
     * For comps, corrections and negotiated moves.
     *
     * <p>The access window is left as-is — no money changed hands, so extending or
     * truncating what the learner already paid for would be arbitrary. The new price takes
     * effect at the next renewal.
     */
    @PostMapping("/{userPlanId}/change-plan")
    public ResponseEntity<UserPlanDTO> changePlan(
            @PathVariable String userPlanId,
            @RequestParam String instituteId,
            @RequestBody PlanChangeRequestDTO request,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        return ResponseEntity.ok(
                userPlanService.adminChangePlan(userPlanId, instituteId, request, userDetails));
    }
}
