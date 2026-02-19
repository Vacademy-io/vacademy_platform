package vacademy.io.admin_core_service.features.user_subscription.service;

import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.util.CollectionUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.notification_service.service.PaymentNotificatonService;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogFilterRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogWithUserPlanDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentPlanDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.SubOrgDetailsDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentLogStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanSourceEnum;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceService;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentStatusEnum;
import vacademy.io.common.logging.SentryLogger;

import vacademy.io.admin_core_service.features.user_subscription.dto.UserPlanDTO;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerEnrollmentEntryService;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.*;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

@Service
@Transactional
public class PaymentLogService {

    private static final Logger log = LoggerFactory.getLogger(PaymentLogService.class);

    @Autowired
    private PaymentLogRepository paymentLogRepository;

    @Autowired
    public UserPlanService userPlanService;

    @Autowired
    public PaymentNotificatonService paymentNotificatonService;
    @Autowired
    private AuthService authService;

    @Autowired
    private UserPlanRepository userPlanRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.institute.repository.InstituteRepository instituteRepository;

    @Autowired
    private InvoiceService invoiceService;

    @Autowired
    private LearnerEnrollmentEntryService learnerEnrollmentEntryService;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    @Lazy
    private vacademy.io.admin_core_service.features.applicant.service.ApplicantService applicantService;

    @Autowired
    private vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository audienceResponseRepository;

    @Autowired
    @Lazy
    private PaymentLogService self;

    public String createPaymentLog(String userId, double paymentAmount, String vendor, String vendorId, String currency,
            UserPlan userPlan) {
        return createPaymentLog(userId, paymentAmount, vendor, vendorId, currency, userPlan, null);
    }

    public String createPaymentLog(String userId, double paymentAmount, String vendor, String vendorId, String currency,
            UserPlan userPlan, String orderId) {
        log.info("Creating payment log for userId={}, amount={}, vendor={}, currency={}, providedOrderId={}", userId,
                paymentAmount,
                vendor, currency, orderId);

        PaymentLog paymentLog = new PaymentLog();
        paymentLog.setStatus(PaymentLogStatusEnum.INITIATED.name());
        paymentLog.setPaymentAmount(paymentAmount);
        paymentLog.setUserId(userId);
        paymentLog.setPaymentStatus(null);
        paymentLog.setVendor(vendor);
        paymentLog.setVendorId(vendorId);
        paymentLog.setDate(new Date());
        paymentLog.setCurrency(currency);
        paymentLog.setUserPlan(userPlan);

        // If an orderId is provided (e.g. multi-package), store it in a minimal JSON
        // structure
        // so it can be searched later.
        if (StringUtils.hasText(orderId)) {
            paymentLog.setPaymentSpecificData(JsonUtil.toJson(Map.of("originalRequest", Map.of("order_id", orderId))));
        }

        PaymentLog savedLog = savePaymentLog(paymentLog);

        log.info("Payment log created with ID={}", savedLog.getId());

        return savedLog.getId();
    }

    private PaymentLog savePaymentLog(PaymentLog paymentLog) {
        log.debug("Saving payment log: {}", paymentLog);
        return paymentLogRepository.save(paymentLog);
    }

    public void updatePaymentLog(String paymentLogId, String status, String paymentStatus, String paymentSpecificData) {
        log.info("Updating payment log: id={}, status={}, paymentStatus={}", paymentLogId, status, paymentStatus);

        PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId).orElseThrow(() -> {
            log.error("Payment log not found with ID: {}", paymentLogId);
            SentryLogger.logError(new RuntimeException("Payment log not found with ID: " + paymentLogId),
                    "Payment log not found during update", Map.of(
                            "payment.log.id", paymentLogId,
                            "payment.status", status,
                            "payment.payment.status", paymentStatus != null ? paymentStatus : "unknown",
                            "operation", "updatePaymentLog"));
            return new RuntimeException("Payment log not found with ID: " + paymentLogId);
        });

        paymentLog.setStatus(status);
        if (StringUtils.hasText(paymentStatus)) {
            paymentLog.setPaymentStatus(paymentStatus);
        }
        // Note: If paymentStatus is not provided, keep existing value (including null)
        paymentLog.setPaymentSpecificData(paymentSpecificData);

        paymentLogRepository.save(paymentLog);

        log.debug("Payment log updated successfully for ID={}", paymentLogId);

        // When payment is PAID (e.g. synchronous Stripe success), run sync-only post-payment logic:
        // cleanup + invoice generation (and invoice email if enabled). Do NOT call applicant service
        // (that is for applicant flow). applyOperationsOnFirstPayment is run by the enroll flow after
        // handlePayment returns.
        if (PaymentStatusEnum.PAID.name().equals(paymentStatus)) {
            String instituteId = resolveInstituteIdForPaymentLog(paymentLog);
            if (StringUtils.hasText(instituteId)) {
                try {
                    handlePostPaymentLogicForSyncPayment(paymentLog, instituteId);
                } catch (Exception e) {
                    log.error("Post-payment logic failed for payment log {} (invoice/cleanup may be skipped): {}",
                            paymentLogId, e.getMessage(), e);
                    SentryLogger.logError(e, "Post-payment logic failed after 4-arg updatePaymentLog", Map.of(
                            "payment.log.id", paymentLogId,
                            "operation", "handlePostPaymentLogicForSyncPayment"));
                    // Do not rethrow: payment is already recorded as PAID; enrollment flow continues
                }
            } else {
                log.warn("Could not resolve instituteId for payment log {}, skipping post-payment logic (e.g. invoice generation)", paymentLogId);
            }
        }
    }

    /**
     * Post-payment logic for the 4-arg updatePaymentLog path (synchronous payment, e.g. Stripe same-request success).
     * Runs only cleanup and invoice generation (and invoice email when institute setting is on).
     * Does NOT call applicant service (different use case) or applyOperationsOnFirstPayment (done by enroll flow).
     */
    private void handlePostPaymentLogicForSyncPayment(PaymentLog paymentLog, String instituteId) {
        handlePaymentSuccessEntryCleanup(paymentLog, instituteId);

        if (paymentLog.getUserPlan() == null) {
            log.info("Payment marked as PAID for donation (sync path), sending donation confirmation notification");
            handleDonationPaymentConfirmation(paymentLog, instituteId);
            return;
        }

        if (paymentLog.getPaymentAmount() != null && paymentLog.getPaymentAmount() > 0) {
            try {
                log.info("Generating invoice for payment log ID: {} (sync path)", paymentLog.getId());
                invoiceService.generateInvoice(
                        paymentLog.getUserPlan(),
                        paymentLog,
                        instituteId);
                log.info("Invoice generated successfully for payment log ID: {}", paymentLog.getId());
            } catch (Exception e) {
                log.error(
                        "Failed to generate invoice for payment log ID: {}. Payment confirmation will continue without invoice.",
                        paymentLog.getId(), e);
            }
        }
    }

    /**
     * Resolve institute ID from payment log's user plan and enroll invite (for post-payment logic).
     */
    private String resolveInstituteIdForPaymentLog(PaymentLog paymentLog) {
        if (paymentLog == null || paymentLog.getUserPlan() == null) {
            return null;
        }
        try {
            if (paymentLog.getUserPlan().getEnrollInvite() != null) {
                return paymentLog.getUserPlan().getEnrollInvite().getInstituteId();
            }
        } catch (Exception e) {
            log.debug("Could not get instituteId from payment log {}: {}", paymentLog.getId(), e.getMessage());
        }
        return null;
    }

    /**
     * Legacy method for backward compatibility with existing payment gateways.
     * Delegates to updatePaymentLogsByOrderId.
     * 
     * @param orderId       The order ID from the payment gateway webhook
     * @param paymentStatus The new payment status to set
     * @param instituteId   The institute ID for post-payment processing
     */
    @Transactional
    public void updatePaymentLog(String orderId, String paymentStatus, String instituteId) {
        updatePaymentLogsByOrderId(orderId, paymentStatus, instituteId);
    }

    /**
     * Fast update method for Cashfree: uses ONLY payment_log.id (PK lookup), NEVER queries JSON column.
     * Cashfree webhook sends order_id which equals payment_log.id, so we can skip expensive JSON LIKE scans.
     * 
     * CRITICAL: For Cashfree webhook path, we ONLY persist payment_status and return quickly.
     * We intentionally DO NOT run post-payment operations here because they can be slow, can involve
     * JSON queries (e.g. applicant_stage lookup), and can exhaust DB connections under load.
     * 
     * @param paymentLogId  The payment log ID (same as Cashfree order_id)
     * @param paymentStatus The new payment status to set
     * @param instituteId   The institute ID for post-payment processing
     */
    @Transactional
    public void updatePaymentLogByPaymentLogId(String paymentLogId, String paymentStatus, String instituteId) {
        log.info("Updating payment log by ID={} (Cashfree fast path, no JSON search), setting paymentStatus={}", 
                paymentLogId, paymentStatus);

        Optional<PaymentLog> logOpt = paymentLogRepository.findById(paymentLogId);
        if (!logOpt.isPresent()) {
            log.error("Payment log not found with ID={} (Cashfree webhook)", paymentLogId);
            SentryLogger.SentryEventBuilder.error(new RuntimeException("Payment log not found by ID"))
                    .withMessage("Payment log not found for Cashfree webhook")
                    .withTag("payment.log.id", paymentLogId)
                    .withTag("payment.payment.status", paymentStatus)
                    .send();
            throw new RuntimeException("Payment log not found with ID: " + paymentLogId);
        }

        PaymentLog paymentLog = logOpt.get();
        List<PaymentLog> allLogsToUpdate = new ArrayList<>();
        allLogsToUpdate.add(paymentLog);

        // Check for child logs if it's a parent transaction
        try {
            if (StringUtils.hasText(paymentLog.getPaymentSpecificData())) {
                Map<String, Object> data = JsonUtil.fromJson(paymentLog.getPaymentSpecificData(), Map.class);
                if (data != null && data.containsKey("childPaymentLogIds")) {
                    List<String> childIds = (List<String>) data.get("childPaymentLogIds");
                    if (childIds != null && !childIds.isEmpty()) {
                        log.info("Parent log {} has {} child logs. Adding them to update list.", paymentLog.getId(),
                                childIds.size());
                        for (String childId : childIds) {
                            paymentLogRepository.findById(childId).ifPresent(childLog -> {
                                if (!allLogsToUpdate.contains(childLog)) {
                                    allLogsToUpdate.add(childLog);
                                }
                            });
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Error checking for child logs in payment log {}: {}", paymentLog.getId(), e.getMessage());
        }

        // Idempotency: avoid redundant DB writes/flushes when status is already set (common with webhook retries/duplicates).
        List<PaymentLog> logsNeedingUpdate = new ArrayList<>();
        for (PaymentLog logToUpdate : allLogsToUpdate) {
            String current = logToUpdate.getPaymentStatus();
            if (!StringUtils.hasText(current) || !current.equalsIgnoreCase(paymentStatus)) {
                logsNeedingUpdate.add(logToUpdate);
            }
        }
        if (logsNeedingUpdate.isEmpty()) {
            log.info("Skipping update: payment status is already {} for payment log ID {} (and any child logs)", paymentStatus, paymentLogId);
            return;
        }

        // STEP 1: Update payment status FIRST and commit immediately (critical path)
        log.info("Updating payment status for {} logs (Parent + Children) for payment log ID {}", 
                logsNeedingUpdate.size(), paymentLogId);
        for (PaymentLog logToUpdate : logsNeedingUpdate) {
            log.info("Updating log {} (UserPlan: {}, Vendor: {}) with status {}",
                    logToUpdate.getId(),
                    logToUpdate.getUserPlan() != null ? logToUpdate.getUserPlan().getId() : "N/A",
                    logToUpdate.getVendor(),
                    paymentStatus);

            logToUpdate.setPaymentStatus(paymentStatus);
            paymentLogRepository.saveAndFlush(logToUpdate); // Commit immediately - payment status is now PAID
        }

        // STEP 2: Run post-payment logic in separate transaction(s) so courses become visible and invoice/notifications run.
        // Only one event (PAYMENT_SUCCESS_WEBHOOK) is accepted by Cashfree webhook, so duplicate load is avoided.
        if (PaymentStatusEnum.PAID.name().equals(paymentStatus) || PaymentStatusEnum.FAILED.name().equals(paymentStatus)) {
            for (PaymentLog logToUpdate : logsNeedingUpdate) {
                try {
                    self.handlePostPaymentLogicInNewTransaction(logToUpdate, paymentStatus, instituteId);
                } catch (Exception e) {
                    log.error("Post-payment logic failed for log {} (payment status already saved): {}. Non-critical.",
                            logToUpdate.getId(), e.getMessage());
                    SentryLogger.logError(e, "Post-payment logic failure (payment status already saved)", Map.of(
                            "payment.log.id", logToUpdate.getId(),
                            "payment.status", paymentStatus));
                }
            }
        }
    }

    /**
     * Runs post-payment logic in a NEW transaction (REQUIRES_NEW) so failures don't rollback payment status.
     * This includes: notifications, invoices, applicant sync, etc.
     * 
     * @param paymentLog    The payment log that was already updated to PAID/FAILED
     * @param paymentStatus The payment status (PAID or FAILED)
     * @param instituteId   The institute ID
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handlePostPaymentLogicInNewTransaction(PaymentLog paymentLog, String paymentStatus, String instituteId) {
        log.info("Running post-payment logic in separate transaction for payment log ID={}", paymentLog.getId());
        handlePostPaymentLogic(paymentLog, paymentStatus, instituteId);
    }

    /**
     * Updates all PaymentLog entries where the orderId is found in
     * payment_specific_data JSON.
     * This method is specifically designed for webhook callbacks (e.g., PhonePe)
     * where
     * the orderId is passed and all related payment logs need to be updated.
     * 
     * @param orderId       The order ID from the payment gateway webhook
     * @param paymentStatus The new payment status to set
     * @param instituteId   The institute ID for post-payment processing
     */
    @Transactional
    public void updatePaymentLogsByOrderId(String orderId, String paymentStatus, String instituteId) {
        log.info("Attempting to update payment logs by Order ID={}, setting paymentStatus={}", orderId, paymentStatus);

        List<PaymentLog> paymentLogs = new ArrayList<>();
        int maxRetries = 10;

        // --- FAST PATH (preferred): treat webhook orderId as PaymentLog PK ---
        // In most of our flows (e.g. CASHFREE), the gateway "order_id" is the same UUID we generate for payment_log.id.
        // Doing a PK lookup avoids expensive JSON LIKE scans on payment_specific_data.
        Optional<PaymentLog> pkLogOpt = paymentLogRepository.findById(orderId);
        if (pkLogOpt.isPresent()) {
            paymentLogs.add(pkLogOpt.get());
            log.info("Found payment log by PK id={} (skipping JSON order-id scan)", orderId);
        }

        // --- Multi-Package Logic: Check for child logs if it's a parent transaction
        // ---
        List<PaymentLog> allLogsToUpdate = new ArrayList<>(paymentLogs);
        for (PaymentLog pLogItem : paymentLogs) {
            try {
                if (StringUtils.hasText(pLogItem.getPaymentSpecificData())) {
                    Map<String, Object> data = JsonUtil.fromJson(pLogItem.getPaymentSpecificData(), Map.class);
                    if (data != null && data.containsKey("childPaymentLogIds")) {
                        List<String> childIds = (List<String>) data.get("childPaymentLogIds");
                        if (childIds != null && !childIds.isEmpty()) {
                            log.info("Parent log {} has {} child logs. Adding them to update list.", pLogItem.getId(),
                                    childIds.size());
                            for (String childId : childIds) {
                                paymentLogRepository.findById(childId).ifPresent(childLog -> {
                                    if (!allLogsToUpdate.contains(childLog)) {
                                        allLogsToUpdate.add(childLog);
                                    }
                                });
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Error checking for child logs in payment log {}: {}", pLogItem.getId(), e.getMessage());
            }
        }

        if (allLogsToUpdate.isEmpty()) {
            log.error("No payment logs found after {} retries for ID/Order={}", maxRetries, orderId);
            SentryLogger.SentryEventBuilder.error(new RuntimeException("Payment logs not found after retries"))
                    .withMessage("Payment logs not found after multiple retries")
                    .withTag("order.id", orderId)
                    .withTag("payment.payment.status", paymentStatus)
                    .send();
            throw new RuntimeException("Payment log not found with ID/Order: " + orderId);
        }

        // --- Atomic Update of ALL found logs (Parent + Children) ---
        log.info("Starting atomic update for {} total logs (Parent + Children) for ID/Order {}", allLogsToUpdate.size(),
                orderId);
        for (PaymentLog paymentLog : allLogsToUpdate) {
            try {
                log.info("Updating log {} (UserPlan: {}, Vendor: {}) with status {}",
                        paymentLog.getId(),
                        paymentLog.getUserPlan() != null ? paymentLog.getUserPlan().getId() : "N/A",
                        paymentLog.getVendor(),
                        paymentStatus);

                paymentLog.setPaymentStatus(paymentStatus);
                paymentLogRepository.saveAndFlush(paymentLog); // Flush immediately to ensure DB update

                // Trigger post-payment operations if status is PAID
                handlePostPaymentLogic(paymentLog, paymentStatus, instituteId);
            } catch (Exception e) {
                log.error("Failed to process atomic update for log {}: {}. Continuing with remaining logs.",
                        paymentLog.getId(), e.getMessage());
                SentryLogger.logError(e, "Post-payment logic failure in atomic update", Map.of(
                        "payment.log.id", paymentLog.getId(),
                        "order.id", orderId,
                        "payment.status", paymentStatus));
            }
        }
    }

    /**
     * Refactored logic to handle actions after status update.
     * Handles both PAID and FAILED statuses for ABANDONED_CART entry management.
     */
    private void handlePostPaymentLogic(PaymentLog paymentLog, String paymentStatus, String instituteId) {
        // Handle payment failure - create PAYMENT_FAILED entry
        if (PaymentStatusEnum.FAILED.name().equals(paymentStatus)) {
            log.info("Payment FAILED for log {}, handling failure flow", paymentLog.getId());
            handlePaymentFailure(paymentLog, instituteId);
            return;
        }

        if (!PaymentStatusEnum.PAID.name().equals(paymentStatus)) {
            log.info("Payment status is {}, skipping post-payment logic for log {}", paymentStatus, paymentLog.getId());
            return;
        }

        // Handle payment success - mark ABANDONED_CART as DELETED
        handlePaymentSuccessEntryCleanup(paymentLog, instituteId);

        // Check if this is a donation (null user plan ID)
        if (paymentLog.getUserPlan() == null) {
            log.info("Payment marked as PAID for donation, sending donation confirmation notification");
            // Handle donation payment confirmation
            handleDonationPaymentConfirmation(paymentLog, instituteId);
        } else {
            log.info("Payment marked as PAID, triggering applyOperationsOnFirstPayment for userPlan ID={}",
                    paymentLog.getUserPlan().getId());
            userPlanService.applyOperationsOnFirstPayment(paymentLog.getUserPlan());

            // Generate invoice for paid enrollments
            if (paymentLog.getPaymentAmount() != null && paymentLog.getPaymentAmount() > 0) {
                try {
                    log.info("Generating invoice for payment log ID: {}", paymentLog.getId());
                    invoiceService.generateInvoice(
                            paymentLog.getUserPlan(),
                            paymentLog,
                            instituteId);
                    log.info("Invoice generated successfully for payment log ID: {}", paymentLog.getId());
                } catch (Exception e) {
                    // Don't fail payment confirmation if invoice generation fails
                    log.error(
                            "Failed to generate invoice for payment log ID: {}. Payment confirmation will continue without invoice.",
                            paymentLog.getId(), e);
                }
            }

            // Applicant sync: only run if the paying user is actually an applicant.
            // Check audience_response by student_user_id with a non-null applicant_id (fast indexed query)
            // to avoid the expensive JSON scan on applicant_stage.response_json for every payment.
            String payingUserId = paymentLog.getUserId();
            Optional<vacademy.io.admin_core_service.features.audience.entity.AudienceResponse> applicantAudienceResponse =
                    Optional.empty();
            if (StringUtils.hasText(payingUserId)) {
                try {
                    applicantAudienceResponse = audienceResponseRepository
                            .findFirstByStudentUserIdAndApplicantIdIsNotNull(payingUserId);
                } catch (Exception ex) {
                    log.error("Failed to check audience_response for applicant gate (userId={}): {}", payingUserId, ex.getMessage());
                }
            }

            if (applicantAudienceResponse.isPresent()) {
                log.info("User {} is an applicant (audienceResponse={}, applicantId={}). Running applicant stage sync.",
                        payingUserId, applicantAudienceResponse.get().getId(), applicantAudienceResponse.get().getApplicantId());
                String orderIdToSync = paymentLog.getId();
                try {
                    Map<String, Object> pData = JsonUtil.fromJson(paymentLog.getPaymentSpecificData(), Map.class);
                    if (pData != null && pData.containsKey("originalRequest")) {
                        Map<String, Object> originalReq = (Map<String, Object>) pData.get("originalRequest");
                        if (originalReq != null && originalReq.containsKey("order_id")) {
                            orderIdToSync = (String) originalReq.get("order_id");
                        }
                    }
                } catch (Exception ex) {
                    log.error("Failed to extract order_id for applicant sync: {}", ex.getMessage());
                }
                self.syncApplicantStageInNewTransaction(orderIdToSync);
            } else {
                log.info("User {} is not an applicant (no audience_response with applicant_id). Skipping applicant stage sync.", payingUserId);
            }

            // Parse the paymentSpecificData which now contains both response and original
            // request
            Map<String, Object> paymentData = JsonUtil.fromJson(paymentLog.getPaymentSpecificData(), Map.class);

            if (paymentData == null) {
                log.error("Payment specific data is null for payment log ID: {}", paymentLog.getId());
                SentryLogger.logError(new IllegalStateException("Payment specific data is null"),
                        "Failed to parse payment specific data", Map.of(
                                "payment.log.id", paymentLog.getId(),
                                "payment.status", PaymentStatusEnum.PAID.name(),
                                "user.id", paymentLog.getUserId() != null ? paymentLog.getUserId() : "unknown",
                                "payment.vendor",
                                paymentLog.getVendor() != null ? paymentLog.getVendor() : "unknown",
                                "operation", "parsePaymentData"));
                return;
            }

            // Extract the response - handle nested response_data structure
            Object responseObj = paymentData.get("response");
            PaymentResponseDTO paymentResponseDTO = null;

            if (responseObj != null) {
                // First try to parse as PaymentResponseDTO (which has response_data nested)
                paymentResponseDTO = JsonUtil.fromJson(
                        JsonUtil.toJson(responseObj),
                        PaymentResponseDTO.class);

                if (paymentResponseDTO == null) {
                    paymentResponseDTO = new PaymentResponseDTO();
                }

                if (paymentResponseDTO.getResponseData() == null) {
                    paymentResponseDTO.setResponseData(new HashMap<>());
                }

                paymentResponseDTO.getResponseData().put("paymentStatus", paymentStatus);

                // Ensure amount and transactionId are present for notifications
                if (!paymentResponseDTO.getResponseData().containsKey("amount")) {
                    paymentResponseDTO.getResponseData().put("amount", paymentLog.getPaymentAmount());
                }
                if (!paymentResponseDTO.getResponseData().containsKey("transactionId")) {
                    paymentResponseDTO.getResponseData().put("transactionId", paymentLog.getId());
                }

                // If responseData field is empty but response_data exists, extract it
                if (paymentResponseDTO != null &&
                        (paymentResponseDTO.getResponseData() == null
                                || paymentResponseDTO.getResponseData().isEmpty())) {

                    Map<String, Object> responseMap = (Map<String, Object>) responseObj;
                    if (responseMap.containsKey("response_data")) {
                        // Use the nested response_data as the responseData
                        paymentResponseDTO.setResponseData((Map<String, Object>) responseMap.get("response_data"));
                        log.debug("Extracted nested response_data for payment log ID: {}", paymentLog.getId());
                    }
                }
            }

            PaymentInitiationRequestDTO paymentInitiationRequestDTO = JsonUtil.fromJson(
                    JsonUtil.toJson(paymentData.get("originalRequest")),
                    PaymentInitiationRequestDTO.class);

            if (paymentResponseDTO == null || paymentInitiationRequestDTO == null) {
                log.error("Could not parse response or original request for payment log ID: {}",
                        paymentLog.getId());
                SentryLogger.logError(new IllegalStateException("Failed to parse payment response/request"),
                        "Could not parse payment response or request data", Map.of(
                                "payment.log.id", paymentLog.getId(),
                                "user.id", paymentLog.getUserId() != null ? paymentLog.getUserId() : "unknown",
                                "payment.vendor",
                                paymentLog.getVendor() != null ? paymentLog.getVendor() : "unknown",
                                "has.response", String.valueOf(paymentResponseDTO != null),
                                "has.request", String.valueOf(paymentInitiationRequestDTO != null),
                                "operation", "parsePaymentResponseRequest"));
                // For MultiPackage legacy mapping, ensure instituteId is set
                if (paymentInitiationRequestDTO != null && paymentInitiationRequestDTO.getInstituteId() == null) {
                    paymentInitiationRequestDTO.setInstituteId(instituteId);
                }
                return;
            }

            // Handle case where email is null in originalRequest - extract from
            // gateway-specific request
            if (paymentInitiationRequestDTO.getEmail() == null) {
                String extractedEmail = extractEmailFromGatewayRequest(paymentInitiationRequestDTO,
                        paymentLog.getId());
                if (extractedEmail != null) {
                    paymentInitiationRequestDTO.setEmail(extractedEmail);
                    log.debug("Extracted email from payment gateway request: {}", extractedEmail);
                }
            }

            UserDTO userDTO = authService.getUsersFromAuthServiceByUserIds(List.of(paymentLog.getUserId())).get(0);
            paymentNotificatonService.sendPaymentConfirmationNotification(instituteId, paymentResponseDTO,
                    paymentInitiationRequestDTO, userDTO);
        }
    }

    /**
     * Runs applicant sync in a new transaction so that failure (e.g. no applicant stage
     * for learner payments) does not mark the webhook transaction rollback-only.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void syncApplicantStageInNewTransaction(String orderId) {
        try {
            applicantService.handlePaymentSuccess(orderId);
            log.info("Applicant stage synced for orderId={} (applicant flow payment).", orderId);
        } catch (Exception e) {
            // No applicant_stage row for this order_id = catalog/learner enrollment (not applicant flow). Normal.
            log.info("Applicant sync skipped for orderId={} (no applicant stage for this order): {}", orderId, e.getMessage());
        }
    }

    /// to do:

    private void handleDonationPaymentConfirmation(PaymentLog paymentLog, String instituteId) {
        try {
            // Parse the paymentSpecificData which now contains both response and original
            // request
            Map<String, Object> paymentData = JsonUtil.fromJson(paymentLog.getPaymentSpecificData(), Map.class);

            if (paymentData == null) {
                log.error("Payment specific data is null for payment log ID: {}", paymentLog.getId());
                SentryLogger.logError(new IllegalStateException("Payment specific data is null for donation"),
                        "Failed to parse donation payment specific data", Map.of(
                                "payment.log.id", paymentLog.getId(),
                                "payment.type", "DONATION",
                                "payment.vendor", paymentLog.getVendor() != null ? paymentLog.getVendor() : "unknown",
                                "operation", "parseDonationPaymentData"));
                return;
            }

            // Extract the original request
            PaymentInitiationRequestDTO originalRequest = JsonUtil.fromJson(
                    JsonUtil.toJson(paymentData.get("originalRequest")),
                    PaymentInitiationRequestDTO.class);

            // Extract the response - handle nested response_data structure
            Object responseObj = paymentData.get("response");
            PaymentResponseDTO paymentResponseDTO = null;

            if (responseObj != null) {
                paymentResponseDTO = JsonUtil.fromJson(
                        JsonUtil.toJson(responseObj),
                        PaymentResponseDTO.class);

                // If responseData field is empty but response_data exists, extract it
                if (paymentResponseDTO != null &&
                        (paymentResponseDTO.getResponseData() == null
                                || paymentResponseDTO.getResponseData().isEmpty())) {

                    Map<String, Object> responseMap = (Map<String, Object>) responseObj;
                    if (responseMap.containsKey("response_data")) {
                        paymentResponseDTO.setResponseData((Map<String, Object>) responseMap.get("response_data"));
                        log.debug("Extracted nested response_data for donation payment log ID: {}", paymentLog.getId());
                    }
                }
            }

            if (originalRequest == null || paymentResponseDTO == null) {
                log.error("Could not parse original request or response for payment log ID: {}", paymentLog.getId());
                SentryLogger.logError(new IllegalStateException("Failed to parse donation payment response/request"),
                        "Could not parse donation payment response or request", Map.of(
                                "payment.log.id", paymentLog.getId(),
                                "payment.type", "DONATION",
                                "payment.vendor", paymentLog.getVendor() != null ? paymentLog.getVendor() : "unknown",
                                "has.response", String.valueOf(paymentResponseDTO != null),
                                "has.request", String.valueOf(originalRequest != null),
                                "operation", "parseDonationResponseRequest"));
                return;
            }

            // Extract email from the original request
            String email = originalRequest.getEmail();
            if (email == null) {
                // Try to extract from gateway-specific request (works for all gateways)
                email = extractEmailFromGatewayRequest(originalRequest, paymentLog.getId());

                if (email != null) {
                    log.debug("Extracted email from payment gateway request for donation: {}", email);
                } else {
                    email = "donation@institute.com";
                    log.warn("No email found in original request for donation payment log ID: {}, using default email",
                            paymentLog.getId());
                }
            }

            paymentNotificatonService.sendDonationPaymentConfirmationNotification(
                    instituteId,
                    paymentResponseDTO,
                    originalRequest,
                    email);
        } catch (Exception e) {
            log.error("Error sending donation payment confirmation notification for payment log ID: {}",
                    paymentLog.getId(), e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to send donation payment confirmation notification")
                    .withTag("payment.log.id", paymentLog.getId())
                    .withTag("payment.type", "DONATION")
                    .withTag("payment.vendor", paymentLog.getVendor() != null ? paymentLog.getVendor() : "unknown")
                    .withTag("payment.amount", String.valueOf(paymentLog.getPaymentAmount()))
                    .withTag("operation", "sendDonationNotification")
                    .send();
        }
    }

    @Transactional(readOnly = true)
    public Page<PaymentLogWithUserPlanDTO> getPaymentLogsForInstitute(
            PaymentLogFilterRequestDTO filterDTO,
            int pageNo,
            int pageSize) {

        validateFilter(filterDTO);

        Sort sort = resolveSort(filterDTO);
        Pageable pageable = PageRequest.of(pageNo, pageSize, sort);
        List<String> paymentStatuses = safeList(filterDTO.getPaymentStatuses());
        List<String> enrollInviteIds = safeList(filterDTO.getEnrollInviteIds());
        List<String> packageSessionIds = safeList(filterDTO.getPackageSessionIds());
        List<String> userPlanStatuses = safeList(filterDTO.getUserPlanStatuses());
        List<String> sources = safeList(filterDTO.getSources());

        LocalDateTime startDate = resolveStartDate(filterDTO);
        LocalDateTime endDate = resolveEndDate(filterDTO);
        String userId = StringUtils.hasText(filterDTO.getUserId()) ? filterDTO.getUserId() : null;
        Page<PaymentLog> paymentLogsPage = paymentLogRepository.findPaymentLogIdsWithFilters(
                filterDTO.getInstituteId(),
                startDate,
                endDate,
                paymentStatuses,
                userPlanStatuses,
                sources,
                enrollInviteIds,
                packageSessionIds,
                userId,
                pageable);

        List<PaymentLog> paymentLogs = paymentLogsPage.getContent();
        Map<String, UserDTO> userMap = fetchUsers(paymentLogs);
        Map<String, Institute> instituteMap = fetchInstitutes(paymentLogs);

        List<PaymentLogWithUserPlanDTO> content = paymentLogs.stream()
                .map(pl -> mapEntityToDTO(pl, userMap, instituteMap))
                .collect(Collectors.toList());

        return new PageImpl<>(content, pageable, paymentLogsPage.getTotalElements());
    }

    // -------------------- Helper Methods --------------------

    private void validateFilter(PaymentLogFilterRequestDTO filterDTO) {
        if (filterDTO == null || !StringUtils.hasText(filterDTO.getInstituteId())) {
            throw new VacademyException("Institute ID is required to fetch payment logs.");
        }
    }

    private Sort resolveSort(PaymentLogFilterRequestDTO filterDTO) {
        Sort sort = ListService.createSortObject(filterDTO.getSortColumns());
        return sort.isUnsorted()
                ? Sort.by(Sort.Direction.DESC, "createdAt")
                : sort;
    }

    private List<String> safeList(List<String> list) {
        return CollectionUtils.isEmpty(list) ? Collections.emptyList() : list;
    }

    private LocalDateTime resolveStartDate(PaymentLogFilterRequestDTO filterDTO) {
        return filterDTO.getStartDateInUtc() != null
                ? filterDTO.getStartDateInUtc()
                : LocalDateTime.of(1970, 1, 1, 0, 0);
    }

    private LocalDateTime resolveEndDate(PaymentLogFilterRequestDTO filterDTO) {
        return filterDTO.getEndDateInUtc() != null
                ? filterDTO.getEndDateInUtc()
                : LocalDateTime.now();
    }

    private Map<String, UserDTO> fetchUsers(List<PaymentLog> paymentLogs) {
        Set<String> userIds = paymentLogs.stream()
                .map(PaymentLog::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (userIds.isEmpty()) {
            return Collections.emptyMap();
        }

        List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(userIds));

        return users.stream()
                .collect(Collectors.toMap(
                        UserDTO::getId,
                        u -> u,
                        (existing, replacement) -> existing));
    }

    private Map<String, Institute> fetchInstitutes(List<PaymentLog> paymentLogs) {
        Set<String> subOrgIds = paymentLogs.stream()
                .map(PaymentLog::getUserPlan)
                .filter(Objects::nonNull)
                .filter(up -> UserPlanSourceEnum.SUB_ORG.name().equals(up.getSource()))
                .map(UserPlan::getSubOrgId)
                .filter(StringUtils::hasText)
                .collect(Collectors.toSet());

        if (subOrgIds.isEmpty()) {
            return Collections.emptyMap();
        }

        log.debug("Fetching {} institutes in bulk for subOrgIds: {}", subOrgIds.size(), subOrgIds);

        // Convert Iterable to List
        Iterable<Institute> iterable = instituteRepository.findAllById(subOrgIds);
        List<Institute> institutes = new ArrayList<>();
        iterable.forEach(institutes::add);

        return institutes.stream()
                .collect(Collectors.toMap(
                        Institute::getId,
                        i -> i,
                        (existing, replacement) -> existing));
    }

    private PaymentLogWithUserPlanDTO mapEntityToDTO(PaymentLog paymentLog, Map<String, UserDTO> userMap,
            Map<String, Institute> instituteMap) {
        PaymentLogDTO paymentLogDTO = paymentLog.mapToDTO();

        UserPlanDTO userPlanDTO = null;
        if (paymentLog.getUserPlan() != null) {
            UserPlan userPlan = paymentLog.getUserPlan();
            PaymentOptionDTO paymentOptionDTO = null;
            if (userPlan.getPaymentOption() != null) {
                paymentOptionDTO = userPlan.getPaymentOption().mapToPaymentOptionDTOWithoutPlans();
            }

            PaymentPlanDTO paymentPlanDTO = null;
            if (userPlan.getPaymentPlan() != null) {
                paymentPlanDTO = userPlan.getPaymentPlan().mapToPaymentPlanDTO();
            }

            // Fetch sub-org details from the pre-fetched map
            SubOrgDetailsDTO subOrgDetails = null;
            if (UserPlanSourceEnum.SUB_ORG.name().equals(userPlan.getSource()) &&
                    StringUtils.hasText(userPlan.getSubOrgId())) {
                Institute institute = instituteMap.get(userPlan.getSubOrgId());
                if (institute != null) {
                    subOrgDetails = SubOrgDetailsDTO.builder()
                            .id(institute.getId())
                            .name(institute.getInstituteName())
                            .address(institute.getAddress())
                            .build();
                } else {
                    log.warn("Institute not found in map for subOrgId={} in UserPlan ID={}",
                            userPlan.getSubOrgId(), userPlan.getId());
                }
            }

            userPlanDTO = UserPlanDTO.builder()
                    .id(userPlan.getId())
                    .userId(userPlan.getUserId())
                    .paymentPlanId(userPlan.getPaymentPlanId())
                    .appliedCouponDiscountId(userPlan.getAppliedCouponDiscountId())
                    .appliedCouponDiscountJson(userPlan.getAppliedCouponDiscountJson())
                    .enrollInviteId(userPlan.getEnrollInviteId())
                    .paymentOptionId(userPlan.getPaymentOptionId())
                    .status(userPlan.getStatus())
                    .source(userPlan.getSource())
                    .subOrgDetails(subOrgDetails)
                    .createdAt(userPlan.getCreatedAt())
                    .updatedAt(userPlan.getUpdatedAt())
                    .paymentLogs(null)
                    .enrollInvite(null)
                    .paymentOption(paymentOptionDTO)
                    .paymentPlanDTO(paymentPlanDTO)
                    .enrollInvite(userPlan.getEnrollInvite().toEnrollInviteDTO())
                    .build();
        }

        UserDTO userDTO = null;
        if (paymentLog.getUserId() != null) {
            userDTO = userMap.get(paymentLog.getUserId());
        }

        String currentPaymentStatus = calculateCurrentPaymentStatus(paymentLog);

        return PaymentLogWithUserPlanDTO.builder()
                .paymentLog(paymentLogDTO)
                .userPlan(userPlanDTO)
                .currentPaymentStatus(currentPaymentStatus)
                .user(userDTO)
                .build();
    }

    private String calculateCurrentPaymentStatus(PaymentLog paymentLog) {
        if (paymentLog.getPaymentStatus() == null) {
            return "NOT_INITIATED";
        }

        if (PaymentStatusEnum.PAID.name().equals(paymentLog.getPaymentStatus())) {
            return PaymentStatusEnum.PAID.name();
        }

        if (PaymentStatusEnum.FAILED.name().equals(paymentLog.getPaymentStatus()) && paymentLog.getUserPlan() != null) {
            UserPlan userPlan = paymentLog.getUserPlan();
            if (userPlan.getEnrollInviteId() != null && userPlan.getUserId() != null) {
                Optional<UserPlan> subsequentActivePlan = userPlanRepository
                        .findFirstByUserIdAndEnrollInviteIdAndCreatedAtAfterOrderByCreatedAtAsc(
                                userPlan.getUserId(),
                                userPlan.getEnrollInviteId(),
                                userPlan.getCreatedAt());

                if (subsequentActivePlan.isPresent()
                        && UserPlanStatusEnum.ACTIVE.equals(subsequentActivePlan.get().getStatus())) {
                    return PaymentStatusEnum.PAID.name();
                }
            }
            return PaymentStatusEnum.FAILED.name();
        }

        return paymentLog.getPaymentStatus();
    }

    // This method is no longer needed as the logic is in the SQL query
    // private String determineCurrentPaymentStatus(PaymentLog paymentLog) { ... }

    // This method is no longer needed as the logic is in the SQL query
    // private String resolveFailedPaymentStatus(PaymentLog paymentLog) { ... }

    @Transactional(readOnly = true)
    public PaymentLogDTO getPaymentLog(String paymentLogId) {
        PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId)
                .orElseThrow(() -> new RuntimeException("Payment log not found with ID: " + paymentLogId));
        return paymentLog.mapToDTO();
    }

    /**
     * Universal helper method to extract email from any payment gateway request
     * object.
     */
    private String extractEmailFromGatewayRequest(PaymentInitiationRequestDTO request, String paymentLogId) {
        try {
            // Try Razorpay request
            if (request.getRazorpayRequest() != null) {
                Map<String, Object> razorpayRequest = (Map<String, Object>) JsonUtil.fromJson(
                        JsonUtil.toJson(request.getRazorpayRequest()),
                        Map.class);
                if (razorpayRequest != null && razorpayRequest.get("email") != null) {
                    return (String) razorpayRequest.get("email");
                }
            }

            // Try Stripe request
            if (request.getStripeRequest() != null) {
                Map<String, Object> stripeRequest = (Map<String, Object>) JsonUtil.fromJson(
                        JsonUtil.toJson(request.getStripeRequest()),
                        Map.class);
                if (stripeRequest != null && stripeRequest.get("email") != null) {
                    return (String) stripeRequest.get("email");
                }
            }

            // Try PayPal request
            if (request.getPayPalRequest() != null) {
                Map<String, Object> paypalRequest = (Map<String, Object>) JsonUtil.fromJson(
                        JsonUtil.toJson(request.getPayPalRequest()),
                        Map.class);
                if (paypalRequest != null && paypalRequest.get("email") != null) {
                    return (String) paypalRequest.get("email");
                }
            }

            // Try Eway request
            if (request.getEwayRequest() != null) {
                Map<String, Object> ewayRequest = (Map<String, Object>) JsonUtil.fromJson(
                        JsonUtil.toJson(request.getEwayRequest()),
                        Map.class);
                if (ewayRequest != null && ewayRequest.get("email") != null) {
                    return (String) ewayRequest.get("email");
                }
            }

            // Try Manual request
            if (request.getManualRequest() != null) {
                Map<String, Object> manualRequest = (Map<String, Object>) JsonUtil.fromJson(
                        JsonUtil.toJson(request.getManualRequest()),
                        Map.class);
                if (manualRequest != null && manualRequest.get("email") != null) {
                    return (String) manualRequest.get("email");
                }
            }

            log.debug("No email found in any payment gateway request for payment log ID: {}", paymentLogId);
            return null;

        } catch (Exception e) {
            log.warn("Error extracting email from payment gateway request for payment log ID: {}: {}",
                    paymentLogId, e.getMessage());
            return null;
        }
    }

    @Transactional
    public void addChildLogsToPayment(String parentId, List<String> childIds) {
        PaymentLog parentLog = paymentLogRepository.findById(parentId)
                .orElseThrow(() -> new RuntimeException("Parent log not found"));

        Map<String, Object> data = new HashMap<>();
        if (StringUtils.hasText(parentLog.getPaymentSpecificData())) {
            data = JsonUtil.fromJson(parentLog.getPaymentSpecificData(), Map.class);
        }

        List<String> existingChildren = (List<String>) data.getOrDefault("childPaymentLogIds", new ArrayList<>());
        existingChildren.addAll(childIds);
        data.put("childPaymentLogIds", existingChildren);

        String sharedData = JsonUtil.toJson(data);
        parentLog.setPaymentSpecificData(sharedData);
        paymentLogRepository.saveAndFlush(parentLog);

        log.info("Linked {} children to parent {}. Syncing paymentSpecificData to all children.", childIds.size(),
                parentId);

        // Sync the same data to all children so they are easily discoverable by the
        // update-by-orderId query
        for (String childId : childIds) {
            paymentLogRepository.findById(childId).ifPresent(childLog -> {
                childLog.setPaymentSpecificData(sharedData);
                paymentLogRepository.saveAndFlush(childLog);
            });
        }
    }

    /**
     * Handles payment failure by marking ABANDONED_CART entries as DELETED
     * and creating PAYMENT_FAILED entries in the INVITED session.
     */
    private void handlePaymentFailure(PaymentLog paymentLog, String instituteId) {
        try {
            UserPlan userPlan = paymentLog.getUserPlan();
            if (userPlan == null) {
                log.warn("UserPlan is null for payment log {}, skipping failure handling", paymentLog.getId());
                return;
            }

            String userId = paymentLog.getUserId();
            if (userId == null) {
                log.warn("UserId is null for payment log {}, skipping failure handling", paymentLog.getId());
                return;
            }

            // Get package session IDs from user plan's enroll invite
            // This needs to be retrieved from the session mappings associated with this
            // user plan
            List<vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping> mappings = learnerEnrollmentEntryService
                    .findOnlyDetailsFilledEntriesForUserPlan(userId, userPlan.getId(), instituteId);

            for (var mapping : mappings) {
                if (mapping.getDestinationPackageSession() == null || mapping.getPackageSession() == null) {
                    continue;
                }

                String actualPackageSessionId = mapping.getDestinationPackageSession().getId();
                String invitedPackageSessionId = mapping.getPackageSession().getId();

                // Mark ABANDONED_CART entries as DELETED
                learnerEnrollmentEntryService.markPreviousEntriesAsDeleted(
                        userId,
                        invitedPackageSessionId,
                        actualPackageSessionId,
                        instituteId);

                // Create PAYMENT_FAILED entry
                PackageSession invitedSession = mapping.getPackageSession();
                PackageSession actualSession = mapping.getDestinationPackageSession();

                learnerEnrollmentEntryService.createPaymentFailedEntry(
                        userId,
                        invitedSession,
                        actualSession,
                        instituteId,
                        userPlan.getId());

                log.info("Created PAYMENT_FAILED entry for user {} in package session {}",
                        userId, actualPackageSessionId);
            }

            // Update UserPlan status to PAYMENT_FAILED
            userPlan.setStatus(UserPlanStatusEnum.PAYMENT_FAILED.name());
            userPlanRepository.save(userPlan);
            log.info("Updated UserPlan {} status to PAYMENT_FAILED", userPlan.getId());

        } catch (Exception e) {
            log.error("Error handling payment failure for log {}: {}", paymentLog.getId(), e.getMessage(), e);
            SentryLogger.logError(e, "Payment failure handling error", Map.of(
                    "payment.log.id", paymentLog.getId(),
                    "user.id", paymentLog.getUserId() != null ? paymentLog.getUserId() : "unknown"));
        }
    }

    /**
     * Handles payment success by marking ABANDONED_CART entries as DELETED.
     * The actual ACTIVE entries are created by
     * UserPlanService.applyOperationsOnFirstPayment().
     */
    private void handlePaymentSuccessEntryCleanup(PaymentLog paymentLog, String instituteId) {
        try {
            UserPlan userPlan = paymentLog.getUserPlan();
            if (userPlan == null) {
                log.debug("UserPlan is null for payment log {}, no entry cleanup needed", paymentLog.getId());
                return;
            }

            String userId = paymentLog.getUserId();
            if (userId == null) {
                log.warn("UserId is null for payment log {}, skipping success entry cleanup", paymentLog.getId());
                return;
            }

            // Get ABANDONED_CART entries for this user plan
            List<vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping> mappings = learnerEnrollmentEntryService
                    .findOnlyDetailsFilledEntriesForUserPlan(userId, userPlan.getId(), instituteId);

            for (var mapping : mappings) {
                if (mapping.getDestinationPackageSession() == null || mapping.getPackageSession() == null) {
                    continue;
                }

                String actualPackageSessionId = mapping.getDestinationPackageSession().getId();
                String invitedPackageSessionId = mapping.getPackageSession().getId();

                // Mark ABANDONED_CART and PAYMENT_FAILED entries as DELETED
                learnerEnrollmentEntryService.markPreviousEntriesAsDeleted(
                        userId,
                        invitedPackageSessionId,
                        actualPackageSessionId,
                        instituteId);

                log.info(
                        "Marked ABANDONED_CART entries as DELETED for user {} in package session {} on payment success",
                        userId, actualPackageSessionId);
            }

        } catch (Exception e) {
            log.error("Error cleaning up entries on payment success for log {}: {}", paymentLog.getId(), e.getMessage(),
                    e);
            // Don't throw - allow the rest of the payment success flow to continue
        }
    }
}
