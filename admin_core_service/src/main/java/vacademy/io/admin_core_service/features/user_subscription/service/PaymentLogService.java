package vacademy.io.admin_core_service.features.user_subscription.service;

import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.notification_service.service.PaymentNotificatonService;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentLogStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
        int maxRetries = 3; // We will try a total of 3 times

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

                // Parse the paymentSpecificData which now contains both response and original request
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
                        PaymentResponseDTO.class
                    );
                    
                    // If responseData field is empty but response_data exists, extract it
                    if (paymentResponseDTO != null && 
                        (paymentResponseDTO.getResponseData() == null || paymentResponseDTO.getResponseData().isEmpty())) {
                        
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
                    PaymentInitiationRequestDTO.class
                );

                if (paymentResponseDTO == null || paymentInitiationRequestDTO == null) {
                    log.error("Could not parse response or original request for payment log ID: {}", paymentLog.getId());
                    return;
                }
                
                // Handle case where email is null in originalRequest - extract from gateway-specific request
                if (paymentInitiationRequestDTO.getEmail() == null) {
                    String extractedEmail = extractEmailFromGatewayRequest(paymentInitiationRequestDTO, paymentLog.getId());
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

    ///  to do:

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
                    PaymentResponseDTO.class
                );
                
                // If responseData field is empty but response_data exists, extract it
                if (paymentResponseDTO != null && 
                    (paymentResponseDTO.getResponseData() == null || paymentResponseDTO.getResponseData().isEmpty())) {
                    
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

    public PaymentLogDTO getPaymentLog(String paymentLogId) {
        PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId)
                .orElseThrow(() -> new RuntimeException("Payment log not found with ID: " + paymentLogId));
        return paymentLog.mapToDTO();
    }

    /**
     * Universal helper method to extract email from any payment gateway request object.
     * Works for Stripe, Razorpay, PayPal, Eway, and any future payment gateways.
     * 
     * @param request The payment initiation request
     * @param paymentLogId The payment log ID (for logging purposes)
     * @return Extracted email or null if not found
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
