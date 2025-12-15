package vacademy.io.admin_core_service.features.user_subscription.service;

import com.razorpay.Payment;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
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

import vacademy.io.admin_core_service.features.user_subscription.dto.UserPlanDTO;

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
    public PaymentNotificatonService paymentNotificatonService;    @Autowired
    private AuthService authService;

    @Autowired
    private UserPlanRepository userPlanRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.institute.repository.InstituteRepository instituteRepository;

    public String createPaymentLog(String userId, double paymentAmount, String vendor, String vendorId, String currency,
                                   UserPlan userPlan) {
        log.info("Creating payment log for userId={}, amount={}, vendor={}, currency={}", userId, paymentAmount,
            vendor, currency);

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
            return new RuntimeException("Payment log not found with ID: " + paymentLogId);
        });

        paymentLog.setStatus(status);
        paymentLog.setPaymentStatus(paymentStatus);
        paymentLog.setPaymentSpecificData(paymentSpecificData);

        paymentLogRepository.save(paymentLog);

        log.debug("Payment log updated successfully for ID={}", paymentLogId);
    }

    @Transactional
    public void updatePaymentLog(String paymentLogId, String paymentStatus, String instituteId) {
        log.info("Attempting to update payment log ID={}, setting paymentStatus={}", paymentLogId, paymentStatus);

        PaymentLog paymentLog = null;
        int maxRetries = 10; // We will try a total of 3 times

        // --- NEW: Retry Loop ---
        for (int i = 0; i < maxRetries; i++) {
            Optional<PaymentLog> logOpt = paymentLogRepository.findById(paymentLogId);
            if (logOpt.isPresent()) {
                paymentLog = logOpt.get();
                log.info("Found payment log {} on attempt {}/{}", paymentLogId, i + 1, maxRetries);
                break; // Found it, so we can exit the loop
            }

            // If not found, wait before trying again
            if (i < maxRetries - 1) {
                try {
                    log.warn("Payment log {} not found. Retrying in 1 second...", paymentLogId);
                    Thread.sleep(2000); // Wait for 1 second
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Thread interrupted during payment log retry", e);
                }
            }
        }

        // After the loop, if the log is still not found, then we throw the error.
        if (paymentLog == null) {
            log.error("Payment log not found after {} retries: ID={}", maxRetries, paymentLogId);
            throw new RuntimeException("Payment log not found with ID: " + paymentLogId);
        }
        paymentLog.setPaymentStatus(paymentStatus);

        paymentLogRepository.save(paymentLog);

        log.info("Payment log saved with new paymentStatus. ID={}", paymentLogId);

        if (PaymentStatusEnum.PAID.name().equals(paymentStatus)) {
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
                    paymentResponseDTO.getResponseData().put("paymentStatus", paymentStatus);

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
    }

    /// to do:

    private void handleDonationPaymentConfirmation(PaymentLog paymentLog, String instituteId) {
        try {
            // Parse the paymentSpecificData which now contains both response and original
            // request
            Map<String, Object> paymentData = JsonUtil.fromJson(paymentLog.getPaymentSpecificData(), Map.class);

            if (paymentData == null) {
                log.error("Payment specific data is null for payment log ID: {}", paymentLog.getId());
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
        }
    }

    public Page<PaymentLogWithUserPlanDTO> getPaymentLogsForInstitute(
        PaymentLogFilterRequestDTO filterDTO,
        int pageNo,
        int pageSize) {

        validateFilter(filterDTO);

        Sort sort = resolveSort(filterDTO);
        Pageable pageable = PageRequest.of(pageNo, pageSize, sort);        List<String> paymentStatuses = safeList(filterDTO.getPaymentStatuses());
        List<String> enrollInviteIds = safeList(filterDTO.getEnrollInviteIds());
        List<String> packageSessionIds = safeList(filterDTO.getPackageSessionIds());
        List<String> userPlanStatuses = safeList(filterDTO.getUserPlanStatuses());
        List<String> sources = safeList(filterDTO.getSources());

        LocalDateTime startDate = resolveStartDate(filterDTO);
        LocalDateTime endDate = resolveEndDate(filterDTO);        Page<PaymentLog> paymentLogsPage = paymentLogRepository.findPaymentLogIdsWithFilters(
            filterDTO.getInstituteId(),
            startDate,
            endDate,
            paymentStatuses,
            userPlanStatuses,
            sources,
            enrollInviteIds,
            packageSessionIds,
            pageable
        );

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
    }    private Map<String, UserDTO> fetchUsers(List<PaymentLog> paymentLogs) {
        Set<String> userIds = paymentLogs.stream()
            .map(PaymentLog::getUserId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

        if (userIds.isEmpty()) {
            return Collections.emptyMap();
        }

        List<UserDTO> users =
            authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(userIds));

        return users.stream()
            .collect(Collectors.toMap(
                UserDTO::getId,
                u -> u,
                (existing, replacement) -> existing
            ));
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
                        (existing, replacement) -> existing
                ));
    }

    private PaymentLogWithUserPlanDTO mapEntityToDTO(PaymentLog paymentLog, Map<String, UserDTO> userMap, Map<String, Institute> instituteMap) {
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

                if (subsequentActivePlan.isPresent() && UserPlanStatusEnum.ACTIVE.equals(subsequentActivePlan.get().getStatus())) {
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
}
