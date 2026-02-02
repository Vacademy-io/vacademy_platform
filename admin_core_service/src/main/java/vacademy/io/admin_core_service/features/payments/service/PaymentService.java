package vacademy.io.admin_core_service.features.payments.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import lombok.extern.slf4j.Slf4j;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentGatewaySpecificPaymentDetailService;
import vacademy.io.admin_core_service.features.payments.manager.PaymentServiceFactory;
import vacademy.io.admin_core_service.features.payments.manager.PaymentServiceStrategy;
import vacademy.io.admin_core_service.features.payments.manager.PhonePePaymentManager;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentLogStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserInstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.dto.PhonePeStatusResponseDTO;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@Transactional
public class PaymentService {

        @Autowired
        private PaymentServiceFactory paymentServiceFactory;

        @Autowired
        private UserInstitutePaymentGatewayMappingService userInstitutePaymentGatewayMappingService;

        @Autowired
        private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

        @Autowired
        private PaymentLogService paymentLogService;

        @Autowired
        private PaymentGatewaySpecificPaymentDetailService paymentGatewaySpecificPaymentDetailService;

        @Autowired
        private UserPlanService userPlanService;

        @Autowired
        private AuthService authService;

        /**
         * Handles payment for learner package enrollment with EnrollInvite.
         */
        public PaymentResponseDTO handlePayment(UserDTO user,
                        LearnerPackageSessionsEnrollDTO enrollDTO,
                        String instituteId,
                        EnrollInvite enrollInvite,
                        UserPlan userPlan) {

                PaymentInitiationRequestDTO request = enrollDTO.getPaymentInitiationRequest();
                if (request == null) {
                        log.error("handlePayment aborted: PaymentInitiationRequest is null");
                        throw new VacademyException("Payment initiation request is missing");
                }
                log.info("handlePayment: amount={}, orderId={}", request.getAmount(), request.getOrderId());

                String paymentLogId = createPaymentLogHelper(
                                user.getId(),
                                request.getAmount(),
                                enrollInvite.getVendor(),
                                enrollInvite.getVendorId(),
                                enrollInvite.getCurrency(),
                                userPlan,
                                request.getOrderId());

                if (!StringUtils.hasText(request.getOrderId())) {
                        request.setOrderId(paymentLogId);
                }

                UserInstitutePaymentGatewayMapping gatewayMapping = createOrGetCustomer(
                                instituteId,
                                user,
                                enrollInvite.getVendor(),
                                request);

                paymentGatewaySpecificPaymentDetailService.configureCustomerPaymentData(
                                gatewayMapping,
                                enrollInvite.getVendor(),
                                request);

                userPlan.setJsonPaymentDetails(JsonUtil.toJson(gatewayMapping));
                userPlanService.save(userPlan);

                PaymentResponseDTO response = makePayment(
                                enrollInvite.getVendor(),
                                instituteId,
                                user,
                                request);

                updatePaymentLogHelper(paymentLogId, response, request);

                // CRITICAL: Always set the payment log ID in the response
                // This is needed for multi-package enrollments to link child logs
                response.setOrderId(paymentLogId);

                return response;
        }

        /**
         * Handles payment log creation without initiating gateway call.
         * Used for multi-package enrollments where one payment covers multiple plans.
         */
        public PaymentResponseDTO handlePaymentWithoutGateway(UserDTO user,
                        LearnerPackageSessionsEnrollDTO enrollDTO,
                        String instituteId,
                        EnrollInvite enrollInvite,
                        UserPlan userPlan) {
                return handlePaymentWithoutGateway(user, enrollDTO, instituteId, enrollInvite, userPlan, Map.of());
        }

        /**
         * Overloaded method to handle payment log creation without initiating gateway
         * call.
         * Allows passing extraData for status overrides.
         */
        public PaymentResponseDTO handlePaymentWithoutGateway(UserDTO user,
                        LearnerPackageSessionsEnrollDTO enrollDTO,
                        String instituteId,
                        EnrollInvite enrollInvite,
                        UserPlan userPlan,
                        Map<String, Object> extraData) {

                PaymentInitiationRequestDTO request = enrollDTO.getPaymentInitiationRequest();

                String paymentLogId = createPaymentLogHelper(
                                user.getId(),
                                request.getAmount(),
                                enrollInvite.getVendor(),
                                enrollInvite.getVendorId(),
                                enrollInvite.getCurrency(),
                                userPlan,
                                request.getOrderId());

                if (!StringUtils.hasText(request.getOrderId())) {
                        request.setOrderId(paymentLogId);
                }

                // Skip gateway interactions, just save plan
                userPlan.setJsonPaymentDetails(JsonUtil
                                .toJson(Map.of("linkedToParentPayment", true, "paymentLogId", paymentLogId)));
                userPlanService.save(userPlan);

                // Create response
                PaymentResponseDTO response = new PaymentResponseDTO();
                response.setOrderId(paymentLogId);
                response.setMessage("Payment Log Created (Gateway Skipped)");
                Map<String, Object> responseData = new HashMap<>();

                String status = PaymentStatusEnum.PAYMENT_PENDING.name();
                if (Boolean.TRUE.equals(extraData.get("FORCE_PAID_STATUS"))) {
                        log.info("Forcing PAID status for skipped payment as requested");
                        status = PaymentStatusEnum.PAID.name();
                }
                responseData.put("paymentStatus", status);
                response.setResponseData(responseData);

                updatePaymentLogHelper(paymentLogId, response, request);

                return response;
        }

        /**
         * Handles payment for unknown users (donations, anonymous payments).
         */
        public PaymentResponseDTO handlePayment(PaymentInitiationRequestDTO request,
                        String instituteId) {

                String paymentLogId = createPaymentLogHelper(
                                null,
                                request.getAmount(),
                                request.getVendor(),
                                request.getVendorId(),
                                request.getCurrency(),
                                null,
                                request.getOrderId());

                request.setOrderId(paymentLogId);

                // Create or get customer for unknown user based on email
                Map<String, Object> gatewayMapping = createOrGetCustomerForUnknownUser(
                                instituteId,
                                request.getEmail(),
                                request.getVendor(),
                                request);

                // Extract customer ID from the gateway mapping for payment configuration

                String customerId = (String) gatewayMapping.get("customerId");
                if (customerId == null) {
                        throw new RuntimeException("Failed to get customer ID from payment gateway");
                }

                paymentGatewaySpecificPaymentDetailService.configureCustomerPaymentData(
                                gatewayMapping,
                                request.getVendor(),
                                request);

                PaymentResponseDTO response = makePayment(
                                request.getVendor(),
                                instituteId,
                                null, // No user for unknown donations
                                request);

                updatePaymentLogHelper(paymentLogId, response, request);

                return response;
        }

        /**
         * Handles payment for UserPlan initiated by user via frontend.
         */
        public PaymentResponseDTO handleUserPlanPayment(PaymentInitiationRequestDTO request,
                        String instituteId,
                        CustomUserDetails userDetails,
                        String userPlanId) {

                String userId = userDetails.getUserId();

                // Validate that user plan exists and belongs to the user
                UserPlan userPlan = userPlanService.findById(userPlanId);

                if (!userPlan.getUserId().equals(userId)) {
                        throw new RuntimeException("User plan does not belong to the specified user");
                }

                // Create payment log for the user plan
                String paymentLogId = createPaymentLogHelper(
                                userId,
                                request.getAmount(),
                                request.getVendor(),
                                request.getVendorId(),
                                request.getCurrency(),
                                userPlan,
                                request.getOrderId());

                request.setOrderId(paymentLogId);

                // Create or get customer for the user
                UserDTO userDTO = getUserById(userId);
                UserInstitutePaymentGatewayMapping gatewayMapping = createOrGetCustomer(
                                instituteId,
                                userDTO,
                                request.getVendor(),
                                request);

                paymentGatewaySpecificPaymentDetailService.configureCustomerPaymentData(
                                gatewayMapping,
                                request.getVendor(),
                                request);

                // Process the payment
                PaymentResponseDTO response = makePayment(
                                request.getVendor(),
                                instituteId,
                                userDTO,
                                request);

                // Update payment log with response
                updatePaymentLogHelper(paymentLogId, response, request);

                return response;
        }

        /**
         * Handles payment for UserPlan with UserDTO (for auto-renewal scenarios).
         * This method is used when we have both UserDTO and UserPlan available,
         * such as in subscription auto-renewal flows.
         * 
         * @param request     Payment initiation request with all payment details
         * @param instituteId Institute ID for payment processing
         * @param user        UserDTO of the user making the payment (ROOT_ADMIN for
         *                    SubOrg)
         * @param userPlan    UserPlan associated with this payment
         * @return PaymentResponseDTO with payment result
         */
        public PaymentResponseDTO handlePaymentWithUser(PaymentInitiationRequestDTO request,
                        String instituteId,
                        UserDTO user,
                        UserPlan userPlan) {

                // Create payment log for the user plan
                String paymentLogId = createPaymentLogHelper(
                                user.getId(),
                                request.getAmount(),
                                request.getVendor(),
                                request.getVendorId(),
                                request.getCurrency(),
                                userPlan,
                                request.getOrderId());

                request.setOrderId(paymentLogId);

                // Create or get customer for the user
                UserInstitutePaymentGatewayMapping gatewayMapping = createOrGetCustomer(
                                instituteId,
                                user,
                                request.getVendor(),
                                request);

                paymentGatewaySpecificPaymentDetailService.configureCustomerPaymentData(
                                gatewayMapping,
                                request.getVendor(),
                                request);

                // Process the payment
                PaymentResponseDTO response = makePayment(
                                request.getVendor(),
                                instituteId,
                                user,
                                request);

                // Update payment log with response
                updatePaymentLogHelper(paymentLogId, response, request);

                return response;
        }

        /**
         * Initiates payment through the configured payment gateway.
         */
        public PaymentResponseDTO makePayment(String vendor, String instituteId, UserDTO user,
                        PaymentInitiationRequestDTO request) {
                Map<String, Object> paymentGatewaySpecificData = institutePaymentGatewayMappingService
                                .findInstitutePaymentGatewaySpecifData(vendor, instituteId);
                PaymentServiceStrategy paymentServiceStrategy = paymentServiceFactory
                                .getStrategy(PaymentGateway.fromString(vendor));
                request.setInstituteId(instituteId);
                return paymentServiceStrategy.initiatePayment(user, request, paymentGatewaySpecificData);
        }

        /**
         * Creates or retrieves existing customer mapping for a user.
         */
        public UserInstitutePaymentGatewayMapping createOrGetCustomer(String instituteId, UserDTO user, String vendor,
                        PaymentInitiationRequestDTO request) {
                Map<String, Object> paymentGatewaySpecificData = institutePaymentGatewayMappingService
                                .findInstitutePaymentGatewaySpecifData(vendor, instituteId);
                Optional<UserInstitutePaymentGatewayMapping> optionalUserInstitutePaymentGatewayMapping = userInstitutePaymentGatewayMappingService
                                .findByUserIdAndInstituteId(user.getId(), instituteId, vendor);
                if (optionalUserInstitutePaymentGatewayMapping.isPresent()) {
                        return optionalUserInstitutePaymentGatewayMapping.get();
                }
                PaymentServiceStrategy paymentServiceStrategy = paymentServiceFactory
                                .getStrategy(PaymentGateway.fromString(vendor));
                Map<String, Object> gatewayCustomerIdAndDataMap = paymentServiceStrategy.createCustomer(user, request,
                                paymentGatewaySpecificData);
                return userInstitutePaymentGatewayMappingService.saveUserInstituteVendorMapping(
                                user.getId(),
                                instituteId,
                                vendor,
                                (String) gatewayCustomerIdAndDataMap.get("customerId"),
                                gatewayCustomerIdAndDataMap);
        }

        /**
         * Creates or retrieves customer for unknown users (email-based).
         */
        public Map<String, Object> createOrGetCustomerForUnknownUser(String instituteId, String email,
                        String vendor, PaymentInitiationRequestDTO request) {
                Map<String, Object> paymentGatewaySpecificData = institutePaymentGatewayMappingService
                                .findInstitutePaymentGatewaySpecifData(vendor, instituteId);

                // Check if customer exists directly from payment gateway
                PaymentServiceStrategy paymentServiceStrategy = paymentServiceFactory
                                .getStrategy(PaymentGateway.fromString(vendor));

                // First try to find existing customer by email
                Map<String, Object> existingCustomer = paymentServiceStrategy.findCustomerByEmail(email,
                                paymentGatewaySpecificData);
                if (existingCustomer != null && existingCustomer.containsKey("customerId")) {
                        // Customer exists, return their data
                        return existingCustomer;
                }

                // Create customer for unknown user if not found
                return paymentServiceStrategy.createCustomerForUnknownUser(email,
                                request, paymentGatewaySpecificData);
        }

        /**
         * Checks payment status for a given order ID.
         * Currently supports PhonePe payment gateway.
         * 
         * @param vendor      Payment gateway vendor
         * @param instituteId Institute ID
         * @param orderId     Order ID to check status for
         * @return Map containing payment status and details
         */
        public Map<String, Object> checkPaymentStatus(String vendor, String instituteId, String orderId) {
                Map<String, Object> paymentGatewaySpecificData = institutePaymentGatewayMappingService
                                .findInstitutePaymentGatewaySpecifData(vendor, instituteId);
                PaymentServiceStrategy paymentServiceStrategy = paymentServiceFactory
                                .getStrategy(PaymentGateway.fromString(vendor));

                if (paymentServiceStrategy instanceof PhonePePaymentManager) {
                        PhonePeStatusResponseDTO status = ((PhonePePaymentManager) paymentServiceStrategy)
                                        .checkPaymentStatus(orderId, paymentGatewaySpecificData);

                        // Prepare response map
                        Map<String, Object> responseMap = new HashMap<>();
                        responseMap.put("status", status.getState());
                        responseMap.put("details", status);

                        // Update payment log based on status
                        if ("COMPLETED".equalsIgnoreCase(status.getState())) {
                                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.PAID.name(),
                                                instituteId);
                        } else if ("FAILED".equalsIgnoreCase(status.getState())) {
                                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.FAILED.name(),
                                                instituteId);
                        }

                        return responseMap;
                }

                throw new UnsupportedOperationException("Status check not supported for " + vendor);
        }

        /**
         * Helper method to retrieve user details by ID.
         */
        private UserDTO getUserById(String userId) {
                List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(userId));
                if (users.isEmpty()) {
                        throw new RuntimeException("User not found with ID: " + userId);
                }
                return users.get(0);
        }

        /**
         * Helper method to create payment log with consistent parameters.
         */
        private String createPaymentLogHelper(String userId, Double amount, String vendor, String vendorId,
                        String currency, UserPlan userPlan, String orderId) {
                return paymentLogService.createPaymentLog(
                                userId,
                                amount,
                                vendor,
                                vendorId,
                                currency,
                                userPlan,
                                orderId);
        }

        /**
         * Helper method to update payment log with response data.
         */
        private void updatePaymentLogHelper(String paymentLogId, PaymentResponseDTO response,
                        PaymentInitiationRequestDTO request) {
                Map<String, Object> logData = new HashMap<>();
                logData.put("response", response);
                if (request != null) {
                        logData.put("originalRequest", request);
                }

                String paymentStatus = null;
                if (response.getResponseData() != null) {
                        paymentStatus = (String) response.getResponseData().get("paymentStatus");
                }
                if (!StringUtils.hasText(paymentStatus)) {
                        paymentStatus = PaymentStatusEnum.PAYMENT_PENDING.name();
                }

                paymentLogService.updatePaymentLog(
                                paymentLogId,
                                PaymentLogStatusEnum.ACTIVE.name(),
                                paymentStatus,
                                JsonUtil.toJson(logData));
        }
}