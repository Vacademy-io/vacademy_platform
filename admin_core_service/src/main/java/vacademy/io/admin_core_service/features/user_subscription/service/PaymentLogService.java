package vacademy.io.admin_core_service.features.user_subscription.service;

import com.razorpay.Payment;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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
    private LearnerEnrollmentEntryService learnerEnrollmentEntryService;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

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

        // --- Retry Loop to find by OrderID in JSON or by PK as fallback ---
        for (int i = 0; i < maxRetries; i++) {
            // First check by orderId in originalRequest.order_id JSON path (primary method)
            paymentLogs = paymentLogRepository.findAllByOrderIdInOriginalRequest(orderId);

            // If not found, try the broader search
            if (paymentLogs.isEmpty()) {
                paymentLogs = paymentLogRepository.findAllByOrderIdInJson(orderId);
            }

            // If none found by OrderId, check if the input is actually a PK (legacy/default
            // way)
            if (paymentLogs.isEmpty()) {
                Optional<PaymentLog> logOpt = paymentLogRepository.findById(orderId);
                logOpt.ifPresent(paymentLogs::add);
            }

            if (!paymentLogs.isEmpty()) {
                log.info("Found {} payment logs for ID/Order {} on attempt {}/{}", paymentLogs.size(), orderId, i + 1,
                        maxRetries);
                break;
            }

            if (i < maxRetries - 1) {
                try {
                    log.warn("No payment logs found for {}. Retrying in 2 seconds...", orderId);
                    Thread.sleep(2000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Thread interrupted during payment log retry", e);
                }
            }
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
     * Handles both PAID and FAILED statuses for ONLY_DETAILS_FILL entry management.
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

        // Handle payment success - mark ONLY_DETAILS_FILL as DELETED
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
        Page<PaymentLog> paymentLogsPage = paymentLogRepository.findPaymentLogIdsWithFilters(
                filterDTO.getInstituteId(),
                startDate,
                endDate,
                paymentStatuses,
                userPlanStatuses,
                sources,
                enrollInviteIds,
                packageSessionIds,
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
     * Handles payment failure by marking ONLY_DETAILS_FILL entries as DELETED
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

                // Mark ONLY_DETAILS_FILL entries as DELETED
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
     * Handles payment success by marking ONLY_DETAILS_FILL entries as DELETED.
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

            // Get ONLY_DETAILS_FILL entries for this user plan
            List<vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping> mappings = learnerEnrollmentEntryService
                    .findOnlyDetailsFilledEntriesForUserPlan(userId, userPlan.getId(), instituteId);

            for (var mapping : mappings) {
                if (mapping.getDestinationPackageSession() == null || mapping.getPackageSession() == null) {
                    continue;
                }

                String actualPackageSessionId = mapping.getDestinationPackageSession().getId();
                String invitedPackageSessionId = mapping.getPackageSession().getId();

                // Mark ONLY_DETAILS_FILL and PAYMENT_FAILED entries as DELETED
                learnerEnrollmentEntryService.markPreviousEntriesAsDeleted(
                        userId,
                        invitedPackageSessionId,
                        actualPackageSessionId,
                        instituteId);

                log.info(
                        "Marked ONLY_DETAILS_FILL entries as DELETED for user {} in package session {} on payment success",
                        userId, actualPackageSessionId);
            }

        } catch (Exception e) {
            log.error("Error cleaning up entries on payment success for log {}: {}", paymentLog.getId(), e.getMessage(),
                    e);
            // Don't throw - allow the rest of the payment success flow to continue
        }
    }
}
