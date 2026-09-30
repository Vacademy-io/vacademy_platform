package vacademy.io.admin_core_service.features.user_subscription.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService.VendorInfo;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.plan_change.service.PlanChangeService;
import vacademy.io.admin_core_service.features.user_subscription.dto.MandateInfo;
import vacademy.io.admin_core_service.features.user_subscription.dto.SubscriptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.EwayRequestDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Learner self-service for subscriptions + autopay mandates: list the learner's
 * subscriptions and cancel autopay. Cancelling revokes the mandate and stops
 * future charges but NEVER cuts access early — the learner keeps access until
 * end_date (status CANCELED makes the enrolment processor expire exactly at
 * end_date, no grace). All operations are scoped to the JWT user id.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private final UserPlanRepository userPlanRepository;
    private final UserInstitutePaymentGatewayMappingService mandateService;
    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final WorkflowTriggerService workflowTriggerService;
    private final vacademy.io.admin_core_service.features.payments.service.PaymentService paymentService;
    private final vacademy.io.admin_core_service.features.auth_service.service.AuthService authService;
    private final PlanChangeService planChangeService;
    private final vacademy.io.admin_core_service.features.payments.service.MandateRequestDefaults mandateRequestDefaults;
    private final vacademy.io.admin_core_service.features.enrollment_policy.service.RenewalPaymentService renewalPaymentService;
    private final vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository paymentLogRepository;
    private final InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;
    private final vacademy.io.admin_core_service.features.institute.service.setting.PaymentSettingService paymentSettingService;

    /**
     * Reported back instead of a charge when a stored-token gateway has no card on file for
     * this learner: nothing has been charged and no order exists, and the client is expected
     * to collect a card and call again with it. Deliberately not a {@code PaymentStatusEnum} --
     * no payment reached a status, because none was attempted.
     */
    public static final String RENEWAL_REQUIRES_CARD = "REQUIRES_CARD";

    /**
     * How long a just-submitted manual renewal blocks another one for the same plan. Only
     * has to cover a double-click / impatient retry, because a stored-token charge settles
     * within a second or two.
     */
    private static final long DUPLICATE_RENEWAL_WINDOW_SECONDS = 120;

    private static final List<String> VISIBLE_STATUSES = List.of(
            UserPlanStatusEnum.ACTIVE.name(),
            UserPlanStatusEnum.CANCELED.name(),
            UserPlanStatusEnum.PAYMENT_FAILED.name(),
            // Dunning-expired plans stay visible so the learner can pay manually
            // and reactivate the same membership (renewal payment flow).
            UserPlanStatusEnum.EXPIRED.name());

    public List<SubscriptionDTO> listSubscriptions(String userId, String instituteId) {
        List<UserPlan> plans = userPlanRepository.findAllByUserIdAndInstituteIdAndStatusIn(
                userId, instituteId, VISIBLE_STATUSES);
        // Read the institute's gateways ONCE for the whole list, not once per plan: this is
        // the learner's entire membership list and the mapping is the same for every row.
        List<VendorInfo> activeGateways = institutePaymentGatewayMappingService
                .getAllVendorsForInstitute(instituteId);
        return plans.stream().map(p -> toDto(p, userId, instituteId, activeGateways)).toList();
    }

    /**
     * Cancel autopay for a plan. Revokes the mandate, turns off auto-renewal and
     * marks the plan CANCELED (access continues until end_date). Idempotent.
     */
    @Transactional
    public SubscriptionDTO cancelSubscription(String userId, String instituteId, String userPlanId) {
        UserPlan plan = userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new VacademyException("Subscription not found: " + userPlanId));
        if (!userId.equals(plan.getUserId())) {
            throw new VacademyException("Subscription does not belong to the current user");
        }

        String vendor = resolveVendor(plan);
        if (StringUtils.hasText(vendor)) {
            mandateService.revokeMandate(userId, instituteId, vendor, userPlanId);
        }

        plan.setAutoRenewalEnabled(false);
        plan.setStatus(UserPlanStatusEnum.CANCELED.name());
        userPlanRepository.save(plan);
        log.info("Cancelled autopay for plan {} (user {}); access retained until {}",
                userPlanId, userId, plan.getEndDate());

        // Same SUBSCRIPTION_CANCELLED trigger the admin cancel path fires
        // (UserPlanService.cancelUserPlan) so cancel-reaction workflows cover
        // learner self-service too. Wrapped so a workflow failure can't undo the cancel.
        try {
            Map<String, Object> ctx = new HashMap<>();
            ctx.put("userPlanId", plan.getId());
            ctx.put("userId", plan.getUserId());
            ctx.put("enrollInviteId", plan.getEnrollInviteId());
            ctx.put("paymentPlanId", plan.getPaymentPlanId());
            ctx.put("endDate", plan.getEndDate() != null ? plan.getEndDate().toString() : null);
            ctx.put("selfService", true);
            String eventId = plan.getEnrollInviteId() != null ? plan.getEnrollInviteId() : instituteId;
            workflowTriggerService.handleTriggerEvents(
                    WorkflowTriggerEvent.SUBSCRIPTION_CANCELLED.name(), eventId, instituteId, ctx);
        } catch (Exception wfe) {
            log.warn("Failed to trigger SUBSCRIPTION_CANCELLED workflow for plan {}: {}",
                    userPlanId, wfe.getMessage());
        }

        return toDto(plan, userId, instituteId,
                institutePaymentGatewayMappingService.getAllVendorsForInstitute(instituteId));
    }

    private SubscriptionDTO toDto(UserPlan plan, String userId, String instituteId,
            List<VendorInfo> activeGateways) {
        String vendor = resolveVendor(plan);
        MandateInfo mandate = StringUtils.hasText(vendor)
                ? mandateService.getMandate(userId, instituteId, vendor, plan.getId())
                : null;
        boolean liveMandate = mandate != null
                && MandateInfo.STATUS_ACTIVE.equalsIgnoreCase(mandate.getStatus());

        List<String> packageSessionIds = mappingRepository
                .findByUserPlanIdAndStatus(plan.getId(), LearnerSessionStatusEnum.ACTIVE.name())
                .stream()
                .map(StudentSessionInstituteGroupMapping::getPackageSession)
                .filter(ps -> ps != null)
                .map(ps -> ps.getId())
                .distinct()
                .toList();
        // What the learner is enrolled in, for plan-change purposes: an expired membership
        // has no ACTIVE mapping, and passing an empty list makes the resolver return no
        // targets, which hid "Change plan" from precisely the learners who need it. The DTO
        // keeps reporting only the ACTIVE ones -- that is what "currently enrolled" means.
        List<String> changeablePackageSessionIds = packageSessionIds.isEmpty()
                ? planChangeService.packageSessionIdsForChange(plan.getId())
                : packageSessionIds;

        // Manual renewal is offered whenever autopay will NOT charge this plan:
        // cancelled/failed/expired plans, an active plan whose mandate is gone, a plan
        // in dunning (a charge was presented and refused — renewal_attempt_count is
        // reset to 0 only by a successful renewal), or a plan whose period has already
        // ended without a renewal. The last two matter because our mandate record is
        // never read back from the gateway: a learner whose UPI mandate was cancelled
        // at the bank still shows a "live" mandate here, and on 2026-09-21 seventeen
        // members who had been told to pay could see only "Stop auto-pay".
        boolean inDunning = plan.getRenewalAttemptCount() != null && plan.getRenewalAttemptCount() > 0;
        boolean lapsed = plan.getEndDate() != null && plan.getEndDate().before(new java.util.Date());
        boolean renewalDue = !liveMandate
                || inDunning
                || lapsed
                || UserPlanStatusEnum.CANCELED.name().equals(plan.getStatus())
                || UserPlanStatusEnum.PAYMENT_FAILED.name().equals(plan.getStatus())
                || UserPlanStatusEnum.EXPIRED.name().equals(plan.getStatus());
        // ...and only if a gateway can actually take the payment. Resolved the same way the
        // payment itself will resolve it -- the plan's own vendor when the institute still has
        // that gateway, else the institute's configured one -- so the button is offered exactly
        // when it will work. Before this gate it was offered for every vendor: Vet Education's
        // learner plans carry four different invite vendors (EWAY, STRIPE, RAZORPAY, PHONEPE)
        // while the institute has only eWay configured, so most of the non-eWay ones could
        // never have completed.
        VendorInfo renewalGateway = resolveRenewalGateway(plan, activeGateways);
        boolean canRenewManually = renewalDue && renewalGateway != null;
        String currency = mandate != null && mandate.getCurrency() != null
                ? mandate.getCurrency()
                : (plan.getEnrollInvite() != null ? plan.getEnrollInvite().getCurrency() : null);

        var planChange = planChangeSummary(plan, instituteId, changeablePackageSessionIds);

        return SubscriptionDTO.builder()
                .userPlanId(plan.getId())
                .planName(plan.getPaymentPlan() != null ? plan.getPaymentPlan().getName() : null)
                .status(plan.getStatus())
                .endDate(plan.getEndDate())
                .nextChargeAt(plan.getNextChargeAt())
                .autoRenewalEnabled(plan.getAutoRenewalEnabled())
                .isTrial(plan.getIsTrial())
                .vendor(vendor)
                .mandateStatus(mandate != null ? mandate.getStatus() : null)
                .mandateMaxAmount(mandate != null ? mandate.getMaxAmount() : null)
                .currency(currency)
                .hasActiveMandate(liveMandate)
                .packageSessionIds(packageSessionIds)
                .planPrice(plan.getPaymentPlan() != null ? plan.getPaymentPlan().getActualPrice() : null)
                .vendorId(plan.getEnrollInvite() != null ? plan.getEnrollInvite().getVendorId() : null)
                .canRenewManually(canRenewManually)
                .instantRenewal(renewalGateway != null && isStoredTokenGateway(renewalGateway.getVendor()))
                .renewalVendor(renewalGateway != null ? renewalGateway.getVendor() : null)
                .autopayDefault(autopayDefaultOnRenewal(instituteId))
                .autopayAvailable(isAutopayAvailable(plan))
                .canChangePlan(planChange.canChangePlan())
                .scheduledPlanChange(planChange.scheduledChange())
                .build();
    }

    /**
     * Plan-change state for one membership. Best-effort: a failure here must degrade to
     * "no switching offered", never take down the whole subscriptions list — this endpoint
     * is what the learner's membership card renders from.
     */
    private PlanChangeService.PlanChangeSummary planChangeSummary(UserPlan plan, String instituteId,
            List<String> packageSessionIds) {
        try {
            return planChangeService.summarise(plan, instituteId, packageSessionIds);
        } catch (Exception e) {
            // ERROR with the stack trace, deliberately: degrading to "no switching offered"
            // makes a genuine failure look identical to "correctly not eligible", and that
            // ambiguity has already cost a debugging session. The card still renders.
            log.error("Could not resolve plan-change eligibility for plan {} (institute {}) — "
                    + "reporting not-eligible", plan.getId(), instituteId, e);
            return new PlanChangeService.PlanChangeSummary(false, null);
        }
    }

    /** Whether the plan's invite has autopay configured (AUTOPAY_SETTING.ENABLED). */
    private boolean isAutopayAvailable(UserPlan plan) {
        if (plan.getEnrollInvite() == null || !StringUtils.hasText(plan.getEnrollInvite().getSettingJson())) {
            return false;
        }
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                    .readTree(plan.getEnrollInvite().getSettingJson())
                    .path("setting").path("AUTOPAY_SETTING").path("ENABLED").asBoolean(false);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Start a MANUAL RENEWAL payment for the learner's existing plan ("pay to
     * continue"). Amount/vendor are SERVER-derived from the plan (never trusted
     * from the client). With {@code withAutopay} (allowed only when the invite
     * has AUTOPAY_SETTING.ENABLED) the checkout opens in mandate mode: the same
     * approval charges the price AND registers a fresh UPI Autopay/e-mandate,
     * so future cycles auto-deduct again.
     *
     * <p>Three shapes come back, and the caller branches on {@code response_data}:
     * a CHECKOUT gateway (Razorpay) returns order coordinates for the client to
     * open; a STORED-TOKEN gateway (eWay) with a card on file has already taken the
     * payment and returns {@code paymentStatus: PAID}; and one with no card on file
     * returns {@code paymentStatus: REQUIRES_CARD} having charged nothing, so the
     * client can collect a card and call again passing it as {@code card}.
     */
    public vacademy.io.common.payment.dto.PaymentResponseDTO initiateRenewalPayment(
            vacademy.io.common.auth.model.CustomUserDetails userDetails,
            String instituteId, String userPlanId, boolean withAutopay, String mandateMethod,
            EwayRequestDTO card) {
        UserPlan plan = userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new VacademyException("Subscription not found: " + userPlanId));
        if (!userDetails.getUserId().equals(plan.getUserId())) {
            throw new VacademyException("Subscription does not belong to the current user");
        }
        if (plan.getEnrollInvite() == null) {
            throw new VacademyException("Subscription has no enrollment invite — cannot build payment");
        }
        // A booked downgrade takes effect at exactly this renewal, so the learner must be
        // quoted the plan they are moving TO — billing them the old price here would take
        // money for a plan they will not be on the moment the payment lands.
        var pendingTarget = planChangeService.pendingTargetPlan(plan);
        var payablePlan = pendingTarget != null ? pendingTarget : plan.getPaymentPlan();
        if (payablePlan == null || payablePlan.getActualPrice() <= 0) {
            throw new VacademyException("Subscription has no payable plan price");
        }
        if (withAutopay && !isAutopayAvailable(plan)) {
            throw new VacademyException("Autopay is not enabled for this membership's invite");
        }
        var invite = plan.getEnrollInvite();
        List<vacademy.io.common.auth.dto.UserDTO> users =
                authService.getUsersFromAuthServiceByUserIds(List.of(plan.getUserId()));
        if (users.isEmpty()) {
            throw new VacademyException("Learner account not found");
        }
        var user = users.get(0);

        var request = new vacademy.io.common.payment.dto.PaymentInitiationRequestDTO();
        request.setAmount(payablePlan.getActualPrice());
        request.setCurrency(StringUtils.hasText(invite.getCurrency()) ? invite.getCurrency() : "INR");
        request.setDescription("Membership renewal — "
                + (payablePlan.getName() != null ? payablePlan.getName() : "subscription"));
        request.setInstituteId(instituteId);
        request.setEmail(user.getEmail());
        // Resolved exactly as toDto gated the button, so a plan offered a renewal is never
        // then refused one.
        VendorInfo gateway = resolveRenewalGateway(plan,
                institutePaymentGatewayMappingService.getAllVendorsForInstitute(instituteId));
        if (gateway == null) {
            throw new VacademyException(
                    "This institute has no payment gateway that can take a renewal — please contact support");
        }
        String vendor = gateway.getVendor();
        request.setVendor(vendor);
        request.setVendorId(gateway.getVendorId());
        request.setPaymentType(vacademy.io.common.payment.enums.PaymentType.RENEWAL);

        // Whether this renewal also arms autopay. Two rules, and the gateway decides which:
        //
        //  - CHECKOUT gateway (Razorpay): the learner's own request, or the institute default.
        //  - STORED-TOKEN gateway (eWay): ONLY the institute default. A client-sent withAutopay
        //    is ignored here by design. These learners are never shown a checkbox (there is no
        //    mandate to register), so such a flag can only be spurious -- and on a gateway
        //    holding a card on file, honouring a spurious one would start charging somebody
        //    automatically who never asked. That makes the institute setting the single switch
        //    for card-on-file autopay, which is what "no eWay auto-renewal until we say so"
        //    requires: one place to turn it on, and no client able to bypass it.
        //
        // Either way the invite's own AUTOPAY_SETTING still gates it, and failing that is
        // silently ignored rather than an error -- an institute-wide default must not force
        // recurring billing onto a product never configured for it.
        boolean autopayRequested = isStoredTokenGateway(vendor)
                ? autopayDefaultOnRenewal(instituteId)
                : (withAutopay || autopayDefaultOnRenewal(instituteId));
        boolean armAutopay = autopayRequested && isAutopayAvailable(plan);
        if (withAutopay && isStoredTokenGateway(vendor) && !armAutopay) {
            log.info("Plan {}: ignoring withAutopay on stored-token gateway {} — autopay there "
                    + "is controlled by the institute setting only", plan.getId(), vendor);
        }

        // Stored-token gateway (eWay): the learner's card is already tokenised at the gateway
        // under their TokenCustomerID, so there is nothing for a checkout to collect and no
        // mandate to register -- their click IS the authorisation for this one amount. Charge
        // the token server-side and confirm inline. This whole branch used to be missing:
        // the request carried only a RazorpayRequestDTO, so EwayPaymentManager dereferenced a
        // null ewayRequest and every "Pay to continue" on eWay threw an NPE.
        if (isStoredTokenGateway(vendor)) {
            return chargeStoredTokenRenewal(plan, instituteId, request, user, armAutopay, card);
        }

        var razorpayRequest = new vacademy.io.common.payment.dto.RazorpayRequestDTO();
        razorpayRequest.setContact(user.getMobileNumber());
        razorpayRequest.setEmail(user.getEmail());
        request.setRazorpayRequest(razorpayRequest);

        if (armAutopay) {
            // Mandate-mode checkout: charge + register a fresh recurring mandate. The
            // mandate fields must be filled here just as enrolment fills them — an empty
            // RazorpayRequestDTO makes the gateway fall back to a CARD e-mandate with no
            // ceiling, which is wrong for a learner who authorised UPI Autopay.
            mandateRequestDefaults.applyMaxAmountAndFrequency(request, invite, payablePlan);
            mandateRequestDefaults.applyMethod(request, mandateMethod,
                    plan.getUserId(), instituteId, invite.getVendor());
            return paymentService.handleMandatePayment(user, instituteId, invite, plan, request);
        }
        return paymentService.handleUserPlanPayment(request, instituteId, userDetails, userPlanId);
    }

    /**
     * "Pay to continue" on a stored-token gateway (eWay). Charges the card already held at
     * the gateway and, because that answers synchronously, confirms the renewal inline --
     * the same two steps the autopay sweep performs, just triggered by the learner instead
     * of the scheduler, and without its {@code claimForRenewal} guard (a plan being paid
     * manually has no armed next_charge_at to claim).
     *
     * <p>The mandate's {@code max_amount} is deliberately NOT applied: that cap bounds
     * UNATTENDED charges, whereas here the learner is looking at the amount and pressing pay.
     */
    private vacademy.io.common.payment.dto.PaymentResponseDTO chargeStoredTokenRenewal(
            UserPlan plan, String instituteId,
            PaymentInitiationRequestDTO request,
            vacademy.io.common.auth.dto.UserDTO user,
            boolean withAutopay,
            EwayRequestDTO card) {

        String vendor = request.getVendor();

        // Double-submit guard. A checkout gateway is self-limiting (a second click just opens
        // a modal the learner abandons), but this charge is submitted server-side and settles
        // immediately, so a second click would take a second real payment. Per-log dedupe
        // cannot catch it: each click mints its own payment_log id.
        long recentAttempts = paymentLogRepository.countRecentUnfailedForPlan(
                plan.getId(),
                java.time.LocalDateTime.now().minusSeconds(DUPLICATE_RENEWAL_WINDOW_SECONDS),
                PaymentStatusEnum.FAILED.name());
        if (recentAttempts > 0) {
            throw new VacademyException("A payment for this membership was just submitted. "
                    + "Please refresh the page before trying again.");
        }

        String token = resolveChargeableToken(plan, instituteId, vendor);
        if (!StringUtils.hasText(token)) {
            // No card on file. Rather than dead-ending the learner, tell the client to collect
            // one -- a member whose plan lapsed before tokens existed, or who enrolled on a
            // gateway this institute no longer uses, has no token through no fault of theirs.
            if (card == null || !StringUtils.hasText(card.getCardNumber())) {
                return requiresCardResponse(vendor);
            }
            // Tokenise the entered card FIRST, then charge the token, rather than charging the
            // card directly. Two reasons: the learner ends up with a card on file so every
            // later renewal is one tap, and the direct-card path pre-marks its payment_log
            // PAID from the gateway intent, which would make the renewal confirmation's
            // claimPaidIfNotAlready lose and silently skip extending the membership.
            token = tokeniseCard(plan, instituteId, vendor, request, user, card);
        }

        MandateInfo storedCard = MandateInfo.builder()
                .vendor(vendor)
                .customerId(token)
                .providerRef(token)
                .currency(request.getCurrency())
                .status(MandateInfo.STATUS_ACTIVE)
                .build();

        // Re-arm autopay BEFORE confirming, because handleSuccessfulRenewal only sets the
        // next charge date on a plan that has auto_renewal_enabled. No gateway call is
        // needed: the token autopay will charge is the one being charged right now, which is
        // exactly why this gateway needs no mandate ceremony (and so no method picker).
        if (withAutopay && !Boolean.TRUE.equals(plan.getAutoRenewalEnabled())) {
            plan.setAutoRenewalEnabled(true);
            userPlanRepository.save(plan);
        }

        vacademy.io.common.payment.dto.PaymentResponseDTO response;
        try {
            response = paymentService.handleRecurringCharge(
                    user, instituteId, vendor, request, plan, storedCard);
        } catch (Exception e) {
            // No dunning here: escalating attempt counts belongs to the unattended sweep. The
            // learner just needs the gateway's reason, so they know whether to fix their card.
            log.error("Manual renewal charge failed on {} for plan {}: {}",
                    vendor, plan.getId(), e.getMessage());
            throw new VacademyException("The payment could not be completed: " + e.getMessage());
        }

        try {
            renewalPaymentService.handleRenewalPaymentConfirmation(
                    response.getOrderId(), instituteId, PaymentStatusEnum.PAID, response);
        } catch (Exception e) {
            // The money HAS been taken. This must never read as "payment failed" -- that
            // invites a second payment for the same cycle. The log is PAID, so replaying the
            // confirmation finishes the activation.
            log.error("Manual renewal CHARGED but confirmation failed - plan {} order {} is PAID "
                    + "and NOT yet extended", plan.getId(), response.getOrderId(), e);
            throw new VacademyException("Your payment went through, but activating the membership "
                    + "is taking longer than usual. Please refresh in a minute - do not pay again.");
        }

        // Tell the client it is already done, so it shows success instead of hunting for
        // checkout coordinates. Copied into a mutable map: the gateway manager hands back an
        // immutable Map.of(...).
        Map<String, Object> data = new HashMap<>(
                response.getResponseData() == null ? Map.of() : response.getResponseData());
        data.put("paymentStatus", PaymentStatusEnum.PAID.name());
        data.put("amount", request.getAmount());
        data.put("currency", request.getCurrency());
        response.setResponseData(data);

        log.info("Manual renewal charged inline on {} for plan {} (order {})",
                vendor, plan.getId(), response.getOrderId());
        return response;
    }

    /**
     * Whether this institute arms autopay on a manual renewal by default. Best-effort: a
     * failure to read the setting must degrade to "no autopay", never to charging a member
     * on a recurring basis they did not ask for.
     */
    private boolean autopayDefaultOnRenewal(String instituteId) {
        try {
            return paymentSettingService.isAutopayDefaultOnManualRenewal(instituteId);
        } catch (Exception e) {
            log.warn("Could not read the autopay-on-renewal default for institute {} — "
                    + "treating as off: {}", instituteId, e.getMessage());
            return false;
        }
    }

    /** Nothing charged, no order raised: the client must collect a card and call again. */
    private vacademy.io.common.payment.dto.PaymentResponseDTO requiresCardResponse(String vendor) {
        Map<String, Object> data = new HashMap<>();
        data.put("paymentStatus", RENEWAL_REQUIRES_CARD);
        data.put("vendor", vendor);
        var response = new vacademy.io.common.payment.dto.PaymentResponseDTO();
        response.setResponseData(data);
        return response;
    }

    /**
     * Registers the card the learner just entered as a gateway customer token and returns it.
     *
     * <p>Only the card fields of {@code card} are used. A customerId arriving in the request
     * body is dropped on purpose: honouring one would let a caller charge a card belonging to
     * somebody else, since the token is all eWay needs.
     */
    private String tokeniseCard(UserPlan plan, String instituteId, String vendor,
            PaymentInitiationRequestDTO request,
            vacademy.io.common.auth.dto.UserDTO user,
            EwayRequestDTO card) {
        EwayRequestDTO safeCard = new EwayRequestDTO();
        safeCard.setCardName(card.getCardName());
        safeCard.setCardNumber(card.getCardNumber());
        safeCard.setExpiryMonth(card.getExpiryMonth());
        safeCard.setExpiryYear(card.getExpiryYear());
        safeCard.setCvn(card.getCvn());
        safeCard.setCountryCode(card.getCountryCode());
        request.setEwayRequest(safeCard);

        var mapping = paymentService.createOrGetCustomer(instituteId, user, vendor, request);
        String token = mapping != null ? mapping.getPaymentGatewayCustomerId() : null;
        if (!StringUtils.hasText(token)) {
            throw new VacademyException(
                    "The card could not be saved with the payment gateway. Please try again.");
        }
        log.info("Registered a new {} card token for plan {} during manual renewal",
                vendor, plan.getId());
        return token;
    }

    /**
     * The gateway token to charge for a manual renewal, whatever the mandate says. A learner
     * who cancelled autopay still has a card on file at eWay, and paying once is precisely
     * what they are asking to do -- so a REVOKED mandate's token is still used. The customer
     * mapping is the fallback for plans that never had a mandate row, which is the norm for
     * the eWay members migrated before mandates existed.
     */
    private String resolveChargeableToken(UserPlan plan, String instituteId, String vendor) {
        MandateInfo mandate = mandateService.getMandateOrLegacyToken(
                plan.getUserId(), instituteId, vendor, plan.getId());
        if (mandate != null && StringUtils.hasText(mandate.getCustomerId())) {
            return mandate.getCustomerId();
        }
        return mandateService.findByUserIdAndInstituteId(plan.getUserId(), instituteId, vendor)
                .map(mapping -> mapping.getPaymentGatewayCustomerId())
                .filter(StringUtils::hasText)
                .orElse(null);
    }

    /**
     * The gateway a manual renewal will actually go through, or null when none can.
     *
     * <p>Order is the plan's own vendor first, then the institute's configured gateway. The
     * plan's vendor is only honoured when the institute STILL has that gateway active,
     * because an invite naming a gateway the institute cannot transact on is dead data, not
     * an instruction: Vet Education's learner plans carry EWAY, STRIPE, RAZORPAY and PHONEPE
     * invites while eWay is the only gateway it has credentials for, so ~70 members would
     * otherwise be stuck holding a vendor nobody can charge. Falling back to the institute
     * level is what makes those pay normally.
     *
     * <p>Among several configured gateways a stored-token one wins, so a learner with a card
     * already on file pays in one tap instead of being sent through a checkout.
     */
    private VendorInfo resolveRenewalGateway(UserPlan plan, List<VendorInfo> activeGateways) {
        if (activeGateways == null || activeGateways.isEmpty()) {
            return null;
        }
        PaymentGateway planGateway = gatewayOrNull(resolveVendor(plan));
        if (planGateway != null) {
            for (VendorInfo candidate : activeGateways) {
                if (gatewayOrNull(candidate.getVendor()) == planGateway
                        && supportsManualRenewal(candidate.getVendor())) {
                    // Keep the invite's own vendorId here: for a gateway the plan was actually
                    // sold on it may carry a sub-merchant id that the institute-level mapping
                    // (which stores vendorId == vendor) does not know about.
                    String vendorId = plan.getEnrollInvite() != null
                            && StringUtils.hasText(plan.getEnrollInvite().getVendorId())
                                    ? plan.getEnrollInvite().getVendorId()
                                    : candidate.getVendorId();
                    return new VendorInfo(candidate.getVendor(), vendorId);
                }
            }
        }
        return activeGateways.stream()
                .filter(candidate -> supportsManualRenewal(candidate.getVendor()))
                .min(Comparator.comparingInt(
                        candidate -> isStoredTokenGateway(candidate.getVendor()) ? 0 : 1))
                .orElse(null);
    }

    /**
     * Gateways that charge a card already stored against the learner (card-on-file), so a
     * manual renewal needs neither a checkout nor a mandate registration. eWay is the only
     * one today: Razorpay mints a chargeable token only through a checkout, and Stripe has
     * no chargeRecurring implementation at all.
     */
    private boolean isStoredTokenGateway(String vendor) {
        return gatewayOrNull(vendor) == PaymentGateway.EWAY;
    }

    /** Whether "pay to continue" can actually complete on this gateway. */
    private boolean supportsManualRenewal(String vendor) {
        PaymentGateway gateway = gatewayOrNull(vendor);
        return gateway == PaymentGateway.EWAY || gateway == PaymentGateway.RAZORPAY;
    }

    /**
     * Vendor string to gateway, or null when unset or unrecognised. Deliberately lenient:
     * this runs while rendering the learner's membership list, where prod data includes an
     * 'ewway' typo that must not take the whole list down.
     */
    private PaymentGateway gatewayOrNull(String vendor) {
        if (!StringUtils.hasText(vendor)) {
            return null;
        }
        try {
            return PaymentGateway.fromString(vendor);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    // ── Plan change (learner self-service) ──────────────────────────────────
    //
    // All three go through ownPlan(): the user id comes from the JWT and is checked against
    // the plan, never taken from the request. Same rule as every other method here.

    public vacademy.io.admin_core_service.features.plan_change.dto.PlanChangeOptionsDTO getPlanChangeOptions(
            vacademy.io.common.auth.model.CustomUserDetails userDetails, String instituteId, String userPlanId) {
        return planChangeService.getChangeOptions(ownPlan(userDetails, userPlanId), instituteId);
    }

    public vacademy.io.admin_core_service.features.plan_change.dto.PlanChangeResponseDTO requestPlanChange(
            vacademy.io.common.auth.model.CustomUserDetails userDetails, String instituteId, String userPlanId,
            vacademy.io.admin_core_service.features.plan_change.dto.PlanChangeRequestDTO request) {
        return planChangeService.requestChange(
                ownPlan(userDetails, userPlanId), instituteId, request, userDetails);
    }

    public void cancelScheduledPlanChange(vacademy.io.common.auth.model.CustomUserDetails userDetails,
            String instituteId, String userPlanId) {
        planChangeService.cancelScheduledChange(ownPlan(userDetails, userPlanId).getId());
    }

    /** Loads a plan and refuses it unless it belongs to the caller. */
    private UserPlan ownPlan(vacademy.io.common.auth.model.CustomUserDetails userDetails, String userPlanId) {
        UserPlan plan = userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new VacademyException("Subscription not found: " + userPlanId));
        if (userDetails == null || !userDetails.getUserId().equals(plan.getUserId())) {
            throw new VacademyException("Subscription does not belong to the current user");
        }
        return plan;
    }

    private String resolveVendor(UserPlan plan) {
        if (plan.getEnrollInvite() != null && StringUtils.hasText(plan.getEnrollInvite().getVendor())) {
            return plan.getEnrollInvite().getVendor();
        }
        if (StringUtils.hasText(plan.getJsonPaymentDetails())) {
            try {
                PaymentInitiationRequestDTO req = JsonUtil.fromJson(
                        plan.getJsonPaymentDetails(), PaymentInitiationRequestDTO.class);
                if (req != null && StringUtils.hasText(req.getVendor())) {
                    return req.getVendor().toUpperCase();
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }
}
