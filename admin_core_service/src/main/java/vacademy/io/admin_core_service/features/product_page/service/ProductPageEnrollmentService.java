package vacademy.io.admin_core_service.features.product_page.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldValueSourceTypeEnum;
import vacademy.io.admin_core_service.features.common.service.CustomFieldValueService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.product_page.dto.*;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPageInviteMapping;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.product_page.repository.ProductPageInviteMappingRepository;
import vacademy.io.admin_core_service.features.product_page.repository.ProductPageRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerEnrollmentEntryService;
import vacademy.io.admin_core_service.features.learner.service.LearnerCouponService;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.OneTimePaymentOptionOperation;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLogLineItem;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.AppliedCouponDiscountRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogLineItemRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentPlanRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;
import org.springframework.util.StringUtils;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ProductPageEnrollmentService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String LINE_ITEM_TYPE = "PRODUCT_PAGE_ALLOCATION";

    @Autowired
    private ProductPageRepository coursePageRepository;

    @Autowired
    private ProductPageInviteMappingRepository mappingRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private PaymentPlanRepository paymentPlanRepository;

    @Autowired
    private StudentRegistrationManager studentRegistrationManager;

    @Autowired
    private LearnerEnrollmentEntryService learnerEnrollmentEntryService;

    @Autowired
    private CustomFieldValueService customFieldValueService;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private UserPlanService userPlanService;

    @Autowired
    private OneTimePaymentOptionOperation oneTimePaymentOptionOperation;

    @Autowired
    private PaymentLogRepository paymentLogRepository;

    @Autowired
    private PaymentLogLineItemRepository paymentLogLineItemRepository;

    @Autowired
    private AppliedCouponDiscountRepository appliedCouponDiscountRepository;

    @Autowired
    private ProductPageService coursePageService;

    @Autowired
    private PaymentLogService paymentLogService;

    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    @Autowired
    private AuthService authService;

    @Autowired
    private LearnerCouponService learnerCouponService;

    @Autowired
    private WorkflowEngineService workflowEngineService;

    @Autowired
    private InstituteRepository instituteRepository;

    // -------------------------------------------------------------------------
    // Step 1: form-submit — create user + ABANDONED_CART entries per invite
    // -------------------------------------------------------------------------

    @Transactional
    public ProductPageFormSubmitResponse submitProductPageForm(ProductPageFormSubmitRequest request) {
        log.info("Course page form submit for code={}, institute={}",
                request.getProductPageCode(), request.getInstituteId());

        List<ProductPageInviteMapping> selectedMappings = resolveMappings(
                request.getProductPageCode(), request.getInstituteId(),
                request.getSelectedPsInvitePaymentOptionIds());

        // Create / update user
        UserDTO user = studentRegistrationManager.createUserFromAuthService(
                request.getUserDetails(), request.getInstituteId(), false);

        studentRegistrationManager.createStudentFromRequest(
                user, mapToStudentExtraDetails(request.getLearnerExtraDetails()));

        // Create ABANDONED_CART entry for each selected invite's package session
        List<String> abandonedCartEntryIds = new ArrayList<>();
        for (ProductPageInviteMapping mapping : selectedMappings) {
            String packageSessionId = mapping.getPsInvitePaymentOption().getPackageSession().getId();

            PackageSession invitedSession = learnerEnrollmentEntryService
                    .findInvitedPackageSession(packageSessionId);

            PackageSession actualSession = packageSessionRepository.findById(packageSessionId)
                    .orElseThrow(() -> new VacademyException("PackageSession not found: " + packageSessionId));

            learnerEnrollmentEntryService.markPreviousEntriesAsDeleted(
                    user.getId(), invitedSession.getId(), packageSessionId, request.getInstituteId());

            StudentSessionInstituteGroupMapping entry = learnerEnrollmentEntryService
                    .createOnlyDetailsFilledEntry(user.getId(), invitedSession, actualSession,
                            request.getInstituteId(), null);

            abandonedCartEntryIds.add(entry.getId());
        }

        // Save custom field values
        if (request.getCustomFieldValues() != null && !request.getCustomFieldValues().isEmpty()) {
            customFieldValueService.addCustomFieldValue(
                    request.getCustomFieldValues(),
                    CustomFieldValueSourceTypeEnum.USER.name(),
                    user.getId());
        }

        log.info("Form submitted for user={}, {} ABANDONED_CART entries created", user.getId(),
                abandonedCartEntryIds.size());
        return ProductPageFormSubmitResponse.builder()
                .userId(user.getId())
                .abandonedCartEntryIds(abandonedCartEntryIds)
                .message("Form submitted. Please proceed to payment.")
                .build();
    }

    // -------------------------------------------------------------------------
    // Step 2: enroll — combined payment + split fulfillment
    // Razorpay two-phase flow:
    // Phase 1 (razorpayPaymentId is absent): create order, return key+orderId, DO
    // NOT enroll yet
    // Phase 2 (razorpayPaymentId present): verify signature, create PAID log,
    // enroll
    // All other vendors: single call (FREE, Cashfree redirect, etc.)
    // -------------------------------------------------------------------------

    @Transactional
    public ProductPageEnrollResponse enrollForProductPage(ProductPageEnrollRequest request) {
        log.info("Course page enroll for code={}, institute={}",
                request.getProductPageCode(), request.getInstituteId());

        List<ProductPageInviteMapping> selectedMappings = resolveMappings(
                request.getProductPageCode(), request.getInstituteId(),
                request.getSelectedMappings().stream()
                        .map(ProductPageSelectedMappingDTO::getPsInvitePaymentOptionId)
                        .collect(Collectors.toList()));

        // Validate + compute total server-side
        double serverTotal = 0.0;
        Map<String, PaymentPlan> planByMappingId = new LinkedHashMap<>();
        for (ProductPageSelectedMappingDTO sel : request.getSelectedMappings()) {
            PaymentPlan plan = paymentPlanRepository.findById(sel.getPaymentPlanId())
                    .orElseThrow(() -> new VacademyException("PaymentPlan not found: " + sel.getPaymentPlanId()));
            planByMappingId.put(sel.getPsInvitePaymentOptionId(), plan);
            serverTotal += plan.getActualPrice();
        }

        // Apply coupon discount if provided
        AppliedCouponDiscount couponDiscount = null;
        double discountAmount = 0.0;
        if (request.getCouponCode() != null && !request.getCouponCode().isBlank()) {
            ProductPageCouponValidateResponse couponResp = coursePageService.validateCoupon(
                    request.getProductPageCode(), request.getCouponCode(), serverTotal);
            if (!couponResp.isValid()) {
                throw new VacademyException("Coupon invalid: " + couponResp.getMessage());
            }
            couponDiscount = appliedCouponDiscountRepository.findById(couponResp.getAppliedCouponDiscountId())
                    .orElse(null);
            discountAmount = couponResp.getDiscountValue() != null ? couponResp.getDiscountValue() : 0.0;
        }

        double finalTotal = serverTotal - discountAmount;

        PaymentInitiationRequestDTO payReq = request.getPaymentInitiationRequest();
        payReq.setAmount(finalTotal);

        // Override vendor/vendorId/currency from the first EnrollInvite so we always
        // use
        // the invite's configured payment gateway, ignoring whatever the client sends.
        EnrollInvite firstInvite = null;
        if (!selectedMappings.isEmpty()) {
            firstInvite = selectedMappings.get(0).getPsInvitePaymentOption().getEnrollInvite();
            if (firstInvite.getVendor() != null)
                payReq.setVendor(firstInvite.getVendor());
            if (firstInvite.getVendorId() != null)
                payReq.setVendorId(firstInvite.getVendorId());
            if (firstInvite.getCurrency() != null)
                payReq.setCurrency(firstInvite.getCurrency());
        }

        // Defensive: ensure currency always has a value (Razorpay gateway requires it).
        // Fall back to any plan's currency, then to "INR".
        if (!StringUtils.hasText(payReq.getCurrency())) {
            String planCurrency = planByMappingId.values().stream()
                    .map(vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan::getCurrency)
                    .filter(c -> c != null && !c.isBlank())
                    .findFirst().orElse("INR");
            payReq.setCurrency(planCurrency);
            log.warn("Currency was missing from request; defaulted to {}", planCurrency);
        }

        // Create / find user
        UserDTO user = studentRegistrationManager.createUserFromAuthService(
                request.getUser(), request.getInstituteId(), false);
        payReq.setEmail(user.getEmail());

        // ── Razorpay Phase 1: order creation ──────────────────────────────────
        boolean isRazorpay = "RAZORPAY".equalsIgnoreCase(payReq.getVendor());
        boolean isRazorpayPhase2 = isRazorpay
                && payReq.getRazorpayRequest() != null
                && payReq.getRazorpayRequest().getRazorpayPaymentId() != null
                && !payReq.getRazorpayRequest().getRazorpayPaymentId().isBlank();

        // Free payment options (amount = 0) must never reach a payment gateway
        if (isRazorpay && !isRazorpayPhase2 && finalTotal > 0.0) {
            // Phase 1: create Razorpay order + payment log (PAYMENT_PENDING) — do NOT
            // enroll yet
            PaymentResponseDTO gatewayResponse = paymentService.handlePaymentWithUser(
                    payReq, request.getInstituteId(), user, null);

            String paymentLogId = payReq.getOrderId();
            log.info("Razorpay Phase 1: order created, paymentLogId={}", paymentLogId);

            String razorpayKeyId = null;
            String razorpayOrderId = null;
            if (gatewayResponse != null && gatewayResponse.getResponseData() != null) {
                Object k = gatewayResponse.getResponseData().get("razorpayKeyId");
                if (k instanceof String)
                    razorpayKeyId = (String) k;
                Object o = gatewayResponse.getResponseData().get("razorpayOrderId");
                if (o instanceof String)
                    razorpayOrderId = (String) o;
            }

            return ProductPageEnrollResponse.builder()
                    .paymentLogId(paymentLogId)
                    .userId(user.getId())
                    .status(PaymentStatusEnum.PAYMENT_PENDING.name())
                    .orderId(razorpayOrderId)
                    .razorpayKeyId(razorpayKeyId)
                    .message("Razorpay order created. Please complete payment.")
                    .build();
        }

        // ── Razorpay Phase 2 / gateway-specific payment handling ─────────────
        boolean isManualVendor = "MANUAL".equalsIgnoreCase(payReq.getVendor());
        // True when payment is already confirmed synchronously (no webhook needed)
        boolean isGatewayPaidSync = false;
        String parentPaymentLogId;
        if (isRazorpayPhase2) {
            verifyRazorpaySignature(payReq, request.getInstituteId(), firstInvite);

            // Create a payment log with PAID status (payment already collected by Razorpay)
            parentPaymentLogId = paymentLogService.createPaymentLog(
                    user.getId(), finalTotal,
                    payReq.getVendor(), payReq.getVendorId(), payReq.getCurrency(),
                    null, null);
            payReq.setOrderId(parentPaymentLogId);
            paymentLogService.updatePaymentLog(
                    parentPaymentLogId,
                    "ACTIVE",
                    PaymentStatusEnum.PAID.name(),
                    "{\"razorpayPaymentId\":\"" + payReq.getRazorpayRequest().getRazorpayPaymentId() + "\","
                            + "\"razorpayOrderId\":\"" + payReq.getRazorpayRequest().getRazorpayOrderId() + "\"}");
            log.info("Razorpay Phase 2: payment verified, paymentLogId={}", parentPaymentLogId);

        } else if (finalTotal <= 0.0) {
            // Free enrollment: bypass gateway entirely, create a PAID log directly
            parentPaymentLogId = paymentLogService.createPaymentLog(
                    user.getId(), 0.0, "MANUAL", null,
                    StringUtils.hasText(payReq.getCurrency()) ? payReq.getCurrency() : "INR",
                    null, null);
            paymentLogService.updatePaymentLog(parentPaymentLogId, "ACTIVE", PaymentStatusEnum.PAID.name(), "{}");
            payReq.setOrderId(parentPaymentLogId);
            isGatewayPaidSync = true;
            log.info("Free enrollment: gateway bypassed, created PAID log={}", parentPaymentLogId);
        } else if (isManualVendor) {
            // MANUAL payment: no online gateway; admin will confirm payment offline
            parentPaymentLogId = paymentLogService.createPaymentLog(
                    user.getId(), finalTotal, "MANUAL", null,
                    StringUtils.hasText(payReq.getCurrency()) ? payReq.getCurrency() : "INR",
                    null, null);
            paymentLogService.updatePaymentLog(parentPaymentLogId, "ACTIVE", PaymentStatusEnum.PAYMENT_PENDING.name(), "{}");
            payReq.setOrderId(parentPaymentLogId);
            log.info("MANUAL payment: gateway bypassed, PENDING log={}", parentPaymentLogId);
        } else {
            // Online paid gateway (Cashfree/PhonePe redirect, Stripe, Eway, etc.)
            PaymentResponseDTO gatewayResponse = paymentService.handlePaymentWithUser(
                    payReq, request.getInstituteId(), user, null);
            parentPaymentLogId = payReq.getOrderId();
            log.info("Combined payment initiated, parentPaymentLogId={}", parentPaymentLogId);

            // For redirect-based gateways (Cashfree etc.) return immediately
            String paymentUrl = null;
            if (gatewayResponse != null && gatewayResponse.getResponseData() != null) {
                Object urlObj = gatewayResponse.getResponseData().get("paymentUrl");
                if (urlObj instanceof String)
                    paymentUrl = (String) urlObj;
                // Detect synchronous PAID (Stripe charge_automatically, Eway, etc.)
                Object statusObj = gatewayResponse.getResponseData().get("paymentStatus");
                if (PaymentStatusEnum.PAID.name().equals(statusObj)) {
                    isGatewayPaidSync = true;
                }
            }
            if (paymentUrl != null) {
                // Redirect-based gateway (Cashfree/PhonePe): create UserPlan + SSIGM entries
                // in INVITED status now so the webhook can activate them when the gateway
                // confirms payment via applyOperationsOnFirstPayment().
                List<String> redirectEnrolledSessionIds = new ArrayList<>();
                List<String> childPaymentLogIds = new ArrayList<>();
                vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan firstUserPlan = null;

                for (ProductPageSelectedMappingDTO sel : request.getSelectedMappings()) {
                    ProductPageInviteMapping rdMapping = selectedMappings.stream()
                            .filter(m -> m.getPsInvitePaymentOption().getId().equals(sel.getPsInvitePaymentOptionId()))
                            .findFirst().orElseThrow();

                    PackageSessionLearnerInvitationToPaymentOption rdBridge = rdMapping.getPsInvitePaymentOption();
                    EnrollInvite rdInvite = rdBridge.getEnrollInvite();
                    PaymentPlan rdPlan = planByMappingId.get(sel.getPsInvitePaymentOptionId());

                    PaymentInitiationRequestDTO rdPayReq = clonePaymentRequest(payReq);
                    rdPayReq.setAmount(rdPlan.getActualPrice());

                    LearnerPackageSessionsEnrollDTO rdEnrollDTO = new LearnerPackageSessionsEnrollDTO();
                    rdEnrollDTO.setPackageSessionIds(List.of(rdBridge.getPackageSession().getId()));
                    rdEnrollDTO.setPlanId(rdPlan.getId());
                    rdEnrollDTO.setPaymentOptionId(rdBridge.getPaymentOption().getId());
                    rdEnrollDTO.setEnrollInviteId(rdInvite.getId());
                    rdEnrollDTO.setReferRequest(request.getReferRequest());
                    rdEnrollDTO.setCustomFieldValues(
                            filterFieldsForInvite(request.getCustomFieldValues(), rdInvite.getId()));
                    rdEnrollDTO.setPaymentInitiationRequest(rdPayReq);

                    vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan rdUserPlan =
                            userPlanService.createUserPlan(
                                    user.getId(), rdPlan, couponDiscount, rdInvite,
                                    rdBridge.getPaymentOption(), rdPayReq, "INVITED");

                    Map<String, Object> rdExtraData = new HashMap<>();
                    rdExtraData.put("SKIP_PAYMENT_INITIATION", true);
                    rdExtraData.put("PARENT_PAYMENT_LOG_ID", parentPaymentLogId);

                    LearnerEnrollResponseDTO rdEnrollResp = oneTimePaymentOptionOperation.enrollLearnerToBatch(
                            user, rdEnrollDTO, request.getInstituteId(),
                            rdInvite, rdBridge.getPaymentOption(), rdUserPlan, rdExtraData,
                            request.getLearnerExtraDetails());

                    redirectEnrolledSessionIds.add(rdBridge.getPackageSession().getId());

                    if (firstUserPlan == null) {
                        firstUserPlan = rdUserPlan;
                    } else {
                        // Subsequent mappings: collect child PaymentLog IDs so the webhook
                        // can process them via the childPaymentLogIds multi-package mechanism.
                        if (rdEnrollResp.getPaymentResponse() != null
                                && StringUtils.hasText(rdEnrollResp.getPaymentResponse().getOrderId())) {
                            childPaymentLogIds.add(rdEnrollResp.getPaymentResponse().getOrderId());
                        }
                    }

                    if (parentPaymentLogId != null) {
                        createLineItem(parentPaymentLogId, rdInvite.getId(), (int) Math.round(rdPlan.getActualPrice()));
                    }
                }

                if (parentPaymentLogId != null && discountAmount > 0 && request.getCouponCode() != null) {
                    createLineItem(parentPaymentLogId, "COUPON:" + request.getCouponCode(),
                            -(int) Math.round(discountAmount));
                }

                // Link the first UserPlan to the parent PaymentLog. Without this link,
                // handlePostPaymentLogic() treats the payment as a donation (userPlan == null)
                // and skips applyOperationsOnFirstPayment().
                if (firstUserPlan != null) {
                    final vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan planToLink =
                            firstUserPlan;
                    paymentLogRepository.findById(parentPaymentLogId).ifPresent(parentLog -> {
                        parentLog.setUserPlan(planToLink);
                        if (!childPaymentLogIds.isEmpty()) {
                            String existingData = parentLog.getPaymentSpecificData();
                            Map<String, Object> data = existingData != null
                                    ? JsonUtil.fromJson(existingData, Map.class) : new HashMap<>();
                            if (data == null) data = new HashMap<>();
                            data.put("childPaymentLogIds", childPaymentLogIds);
                            parentLog.setPaymentSpecificData(JsonUtil.toJson(data));
                        }
                        paymentLogRepository.save(parentLog);
                    });
                }

                log.info("Redirect gateway: created {} enrollment entries, linked userPlan to paymentLog={}",
                        redirectEnrolledSessionIds.size(), parentPaymentLogId);

                return ProductPageEnrollResponse.builder()
                        .paymentLogId(parentPaymentLogId)
                        .userId(user.getId())
                        .status("PAYMENT_PENDING")
                        .paymentUrl(paymentUrl)
                        .enrolledPackageSessionIds(redirectEnrolledSessionIds)
                        .message("Redirect to payment gateway")
                        .build();
            }
        }

        // ── Enroll per invite (shared by Phase 2 + non-Razorpay paid flows) ──
        List<String> enrolledSessionIds = new ArrayList<>();
        for (ProductPageSelectedMappingDTO sel : request.getSelectedMappings()) {
            ProductPageInviteMapping mapping = selectedMappings.stream()
                    .filter(m -> m.getPsInvitePaymentOption().getId().equals(sel.getPsInvitePaymentOptionId()))
                    .findFirst()
                    .orElseThrow();

            PackageSessionLearnerInvitationToPaymentOption bridge = mapping.getPsInvitePaymentOption();
            EnrollInvite invite = bridge.getEnrollInvite();
            PaymentPlan plan = planByMappingId.get(sel.getPsInvitePaymentOptionId());

            PaymentInitiationRequestDTO invitePayReq = clonePaymentRequest(payReq);
            invitePayReq.setAmount(plan.getActualPrice());

            LearnerPackageSessionsEnrollDTO enrollDTO = new LearnerPackageSessionsEnrollDTO();
            enrollDTO.setPackageSessionIds(List.of(bridge.getPackageSession().getId()));
            enrollDTO.setPlanId(plan.getId());
            enrollDTO.setPaymentOptionId(bridge.getPaymentOption().getId());
            enrollDTO.setEnrollInviteId(invite.getId());
            enrollDTO.setReferRequest(request.getReferRequest());
            enrollDTO.setCustomFieldValues(filterFieldsForInvite(request.getCustomFieldValues(), invite.getId()));
            enrollDTO.setPaymentInitiationRequest(invitePayReq);

            vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan userPlan = userPlanService
                    .createUserPlan(
                            user.getId(), plan,
                            couponDiscount, invite,
                            bridge.getPaymentOption(), invitePayReq,
                            "INVITED");

            Map<String, Object> extraData = new HashMap<>();
            extraData.put("SKIP_PAYMENT_INITIATION", true);
            if (parentPaymentLogId != null) {
                extraData.put("PARENT_PAYMENT_LOG_ID", parentPaymentLogId);
            }
            if (isRazorpayPhase2 || isGatewayPaidSync) {
                // Payment already confirmed — activate enrollment immediately
                extraData.put("FORCE_PAID_STATUS", true);
            }

            oneTimePaymentOptionOperation.enrollLearnerToBatch(
                    user, enrollDTO, request.getInstituteId(),
                    invite, bridge.getPaymentOption(), userPlan, extraData,
                    request.getLearnerExtraDetails());

            enrolledSessionIds.add(bridge.getPackageSession().getId());
            log.info("Enrolled user={} in session={} for invite={}",
                    user.getId(), bridge.getPackageSession().getId(), invite.getId());

            if (parentPaymentLogId != null) {
                createLineItem(parentPaymentLogId, invite.getId(), (int) Math.round(plan.getActualPrice()));
            }
        }

        if (parentPaymentLogId != null && discountAmount > 0 && request.getCouponCode() != null) {
            createLineItem(parentPaymentLogId, "COUPON:" + request.getCouponCode(), -(int) Math.round(discountAmount));
        }

        boolean sendCredentialsNow = isRazorpayPhase2 || isGatewayPaidSync;
        triggerPostEnrollmentActions(user, request.getInstituteId(), selectedMappings, enrolledSessionIds,
                sendCredentialsNow);

        return ProductPageEnrollResponse.builder()
                .paymentLogId(parentPaymentLogId)
                .userId(user.getId())
                .status(isRazorpayPhase2 || isGatewayPaidSync ? PaymentStatusEnum.PAID.name() : "INITIATED")
                .enrolledPackageSessionIds(enrolledSessionIds)
                .message("Enrollment successful")
                .build();
    }

    private void verifyRazorpaySignature(PaymentInitiationRequestDTO payReq, String instituteId,
            EnrollInvite firstInvite) {
        try {
            Map<String, Object> gatewayData = institutePaymentGatewayMappingService
                    .findInstitutePaymentGatewaySpecifData(payReq.getVendor(), instituteId);
            String keySecret = (String) gatewayData.getOrDefault("publishableKey",
                    gatewayData.get("keySecret"));
            if (keySecret == null) {
                log.warn("Razorpay key_secret not found; skipping signature verification");
                return;
            }
            String razorpayOrderId = payReq.getRazorpayRequest().getRazorpayOrderId();
            String razorpayPaymentId = payReq.getRazorpayRequest().getRazorpayPaymentId();
            String signature = payReq.getRazorpayRequest().getRazorpaySignature();
            if (razorpayOrderId == null || razorpayPaymentId == null || signature == null) {
                throw new VacademyException("Missing Razorpay verification fields");
            }
            String payload = razorpayOrderId + "|" + razorpayPaymentId;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(keySecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash)
                hex.append(String.format("%02x", b));
            if (!hex.toString().equals(signature)) {
                throw new VacademyException("Razorpay payment signature verification failed");
            }
            log.info("Razorpay signature verified for orderId={}", razorpayOrderId);
        } catch (VacademyException ve) {
            throw ve;
        } catch (Exception e) {
            throw new VacademyException("Razorpay signature verification error: " + e.getMessage());
        }
    }

    private void triggerPostEnrollmentActions(
            UserDTO user,
            String instituteId,
            List<ProductPageInviteMapping> enrolledMappings,
            List<String> enrolledPackageSessionIds,
            boolean sendCredentials) {

        // Resolve learner portal URL the same way learner/v1/enroll does it
        String learnerPortalUrl = instituteRepository.findById(instituteId)
                .map(Institute::getLearnerPortalBaseUrl)
                .orElse(null);

        // 1. Credential email — honours the sendCredentials flag.
        // For PAID enrollments the webhook will call this again with
        // sendCredentials=true
        // once payment is confirmed; for FREE / Razorpay-Phase2 we send it now.
        try {
            authService.createUserFromAuthServiceForLearnerEnrollment(
                    user, instituteId, sendCredentials, learnerPortalUrl);
            log.info("Post-enrollment credential email triggered for user={}, sendCredentials={}",
                    user.getId(), sendCredentials);
        } catch (Exception e) {
            log.error("Failed to send credential email for user={}: {}", user.getId(), e.getMessage(), e);
        }

        // 2. Coupon code — idempotent; safe to call even if user was created earlier
        if (sendCredentials) {
            try {
                String inviteCode = enrolledMappings.isEmpty() ? null
                        : enrolledMappings.get(0).getPsInvitePaymentOption().getEnrollInvite().getInviteCode();
                learnerCouponService.generateCouponCodeForLearner(user.getId(), instituteId, inviteCode);
                log.info("Coupon code generated for user={}", user.getId());
            } catch (Exception e) {
                log.error("Failed to generate coupon code for user={}: {}", user.getId(), e.getMessage(), e);
            }
        }

        // 3. Workflow trigger — one run per package session (same as learner/v1/enroll)
        if (!sendCredentials) {
            // Paid enrollment: workflow will fire after payment webhook confirms
            return;
        }
        for (String packageSessionId : enrolledPackageSessionIds) {
            try {
                PackageSession ps = packageSessionRepository.findById(packageSessionId).orElse(null);
                if (ps == null || !learnerEnrollmentEntryService.hasWorkflowConfiguration(ps)) {
                    continue;
                }
                List<String> workflowIds = learnerEnrollmentEntryService.getWorkflowIds(ps);
                for (String workflowId : workflowIds) {
                    try {
                        Map<String, Object> ctx = new HashMap<>();
                        ctx.put("instituteIdForWhatsapp", instituteId);
                        ctx.put("package_session_id", packageSessionId);
                        ctx.put("destination_package_session_id", packageSessionId);
                        ctx.put("name", user.getFullName());

                        Map<String, Object> userMap = new HashMap<>();
                        userMap.put("phone_number", user.getMobileNumber());
                        userMap.put("name", user.getFullName());
                        userMap.put("username", user.getEmail() != null
                                ? user.getEmail().split("@")[0]
                                : user.getId());
                        userMap.put("user_id", user.getId());
                        userMap.put("email", user.getEmail());
                        ctx.put("users", List.of(userMap));

                        workflowEngineService.run(workflowId, ctx);
                        log.info("Workflow {} triggered for user={}, session={}",
                                workflowId, user.getId(), packageSessionId);
                    } catch (Exception e) {
                        log.error("Workflow {} failed for user={}: {}",
                                workflowId, user.getId(), e.getMessage(), e);
                    }
                }
            } catch (Exception e) {
                log.error("Post-enrollment workflow step failed for session={}: {}", packageSessionId, e.getMessage(),
                        e);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private List<ProductPageInviteMapping> resolveMappings(
            String coursePageCode, String instituteId, List<String> psInvitePoIds) {

        var page = coursePageRepository.findByCode(coursePageCode)
                .orElseThrow(() -> new VacademyException("Course page not found: " + coursePageCode));

        if (!page.getInstituteId().equals(instituteId)) {
            throw new VacademyException("Course page does not belong to this institute");
        }

        List<ProductPageInviteMapping> activeMappings = mappingRepository
                .findByProductPageIdAndStatusIn(page.getId(), List.of(STATUS_ACTIVE));

        Set<String> activePoIds = activeMappings.stream()
                .map(m -> m.getPsInvitePaymentOption().getId())
                .collect(Collectors.toSet());

        for (String id : psInvitePoIds) {
            if (!activePoIds.contains(id)) {
                throw new VacademyException("Mapping " + id + " is not part of this course page");
            }
        }

        return activeMappings.stream()
                .filter(m -> psInvitePoIds.contains(m.getPsInvitePaymentOption().getId()))
                .collect(Collectors.toList());
    }

    private PaymentInitiationRequestDTO clonePaymentRequest(PaymentInitiationRequestDTO source) {
        PaymentInitiationRequestDTO clone = new PaymentInitiationRequestDTO();
        clone.setVendor(source.getVendor());
        clone.setVendorId(source.getVendorId());
        clone.setCurrency(source.getCurrency());
        clone.setInstituteId(source.getInstituteId());
        clone.setEmail(source.getEmail());
        clone.setStripeRequest(source.getStripeRequest());
        clone.setRazorpayRequest(source.getRazorpayRequest());
        clone.setEwayRequest(source.getEwayRequest());
        clone.setCashfreeRequest(source.getCashfreeRequest());
        clone.setPhonePeRequest(source.getPhonePeRequest());
        clone.setChargeAutomatically(source.isChargeAutomatically());
        clone.setIncludePendingItems(source.isIncludePendingItems());
        return clone;
    }

    private List<CustomFieldValueDTO> filterFieldsForInvite(
            List<CustomFieldValueDTO> allValues, String inviteId) {
        if (allValues == null)
            return Collections.emptyList();
        return allValues.stream()
                .filter(v -> v.getEnrollInviteIds() == null
                        || v.getEnrollInviteIds().isEmpty()
                        || v.getEnrollInviteIds().contains(inviteId))
                .collect(Collectors.toList());
    }

    private void createLineItem(String paymentLogId, String sourceId, int amount) {
        paymentLogRepository.findById(paymentLogId).ifPresent(log -> {
            PaymentLogLineItem item = new PaymentLogLineItem();
            item.setPaymentLog(log);
            item.setType(LINE_ITEM_TYPE);
            item.setSource("ENROLL_INVITE");
            item.setSourceId(sourceId);
            item.setAmount(amount);
            paymentLogLineItemRepository.save(item);
        });
    }

    private vacademy.io.admin_core_service.features.institute_learner.dto.StudentExtraDetails mapToStudentExtraDetails(
            LearnerExtraDetails extra) {
        if (extra == null)
            return null;
        var d = new vacademy.io.admin_core_service.features.institute_learner.dto.StudentExtraDetails();
        d.setFathersName(extra.getFathersName());
        d.setMothersName(extra.getMothersName());
        d.setParentsMobileNumber(extra.getParentsMobileNumber());
        d.setParentsEmail(extra.getParentsEmail());
        return d;
    }
}
