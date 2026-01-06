package vacademy.io.admin_core_service.features.payments.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentGatewaySpecificPaymentDetailService;
import vacademy.io.admin_core_service.features.notification_service.service.PaymentNotificatonService;
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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
        private PaymentNotificatonService paymentNotificatonService;

        @Autowired
        private PaymentGatewaySpecificPaymentDetailService paymentGatewaySpecificPaymentDetailService;

        @Autowired
        private UserPlanService userPlanService;

        @Autowired
        private AuthService authService;

        /**
<<<<<<< HEAD
         * Handles payment during learner enrollment.
         * Supports OrderId reuse for PhonePe integration.
=======
         * Handles payment for learner package enrollment with EnrollInvite.
>>>>>>> 3844d717f (fix:paymentService changes added)
         */
        public PaymentResponseDTO handlePayment(UserDTO user,
                        LearnerPackageSessionsEnrollDTO enrollDTO,
                        String instituteId,
                        EnrollInvite enrollInvite,
                        UserPlan userPlan) {

                PaymentInitiationRequestDTO request = enrollDTO.getPaymentInitiationRequest();

<<<<<<< HEAD
                // Create payment log - reuse orderId if provided (PhonePe requirement)
                String paymentLogId;
                if (StringUtils.hasText(request.getOrderId())) {
                        paymentLogId = paymentLogService.createPaymentLog(
                                        user.getId(),
                                        request.getAmount(),
                                        enrollInvite.getVendor(),
                                        enrollInvite.getVendorId(),
                                        enrollInvite.getCurrency(),
                                        userPlan,
                                        request.getOrderId());
                } else {
                        paymentLogId = paymentLogService.createPaymentLog(
                                        user.getId(),
                                        request.getAmount(),
                                        enrollInvite.getVendor(),
                                        enrollInvite.getVendorId(),
                                        enrollInvite.getCurrency(),
                                        userPlan);
                }
=======
                String paymentLogId = createPaymentLogHelper(
                                user.getId(),
                                request.getAmount(),
                                enrollInvite.getVendor(),
                                enrollInvite.getVendorId(),
                                enrollInvite.getCurrency(),
                                userPlan);
>>>>>>> 3844d717f (fix:paymentService changes added)

                request.setOrderId(paymentLogId);

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

                return response;
        }

        /**
<<<<<<< HEAD
         * Handles payment for unknown users (donations, guest payments).
=======
         * Handles payment for unknown users (donations, anonymous payments).
>>>>>>> 3844d717f (fix:paymentService changes added)
         */
        public PaymentResponseDTO handlePayment(PaymentInitiationRequestDTO request,
                        String instituteId) {

                String paymentLogId = createPaymentLogHelper(
                                null,
                                request.getAmount(),
                                request.getVendor(),
                                request.getVendorId(),
                                request.getCurrency(),
                                null);

                request.setOrderId(paymentLogId);

                Map<String, Object> gatewayMapping = createOrGetCustomerForUnknownUser(
                                instituteId,
                                request.getEmail(),
                                request.getVendor(),
                                request);

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
                                null,
                                request);

                updatePaymentLogHelper(paymentLogId, response, request);

                return response;
        }

        /**
<<<<<<< HEAD
         * Handles payment for existing UserPlan (manual payment trigger).
         * Supports OrderId reuse for PhonePe integration.
         * Sends payment confirmation notification.
=======
         * Handles payment for UserPlan initiated by user via frontend.
>>>>>>> 3844d717f (fix:paymentService changes added)
         */
        public PaymentResponseDTO handleUserPlanPayment(PaymentInitiationRequestDTO request,
                        String instituteId,
                        CustomUserDetails userDetails,
                        String userPlanId) {

                String userId = userDetails.getUserId();

                UserPlan userPlan = userPlanService.findById(userPlanId);

                if (!userPlan.getUserId().equals(userId)) {
                        throw new RuntimeException("User plan does not belong to the specified user");
                }

<<<<<<< HEAD
                // Create payment log - reuse orderId if provided (PhonePe requirement)
                String paymentLogId;
                if (StringUtils.hasText(request.getOrderId())) {
                        paymentLogId = paymentLogService.createPaymentLog(
                                        userId,
                                        request.getAmount(),
                                        request.getVendor(),
                                        request.getVendorId(),
                                        request.getCurrency(),
                                        userPlan,
                                        request.getOrderId());
                } else {
                        paymentLogId = paymentLogService.createPaymentLog(
                                        userId,
                                        request.getAmount(),
                                        request.getVendor(),
                                        request.getVendorId(),
                                        request.getCurrency(),
                                        userPlan);
                }
=======
                // Create payment log for the user plan
                String paymentLogId = createPaymentLogHelper(
                                userId,
                                request.getAmount(),
                                request.getVendor(),
                                request.getVendorId(),
                                request.getCurrency(),
                                userPlan);
>>>>>>> 3844d717f (fix:paymentService changes added)

                request.setOrderId(paymentLogId);

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

                PaymentResponseDTO response = makePayment(
                                request.getVendor(),
                                instituteId,
                                userDTO,
                                request);

                // Send payment confirmation notification (PhonePe feature)
                paymentNotificatonService.sendPaymentConfirmationNotification(
                                instituteId,
                                response,
                                request,
                                userDTO);

<<<<<<< HEAD
                paymentLogService.updatePaymentLog(
                                paymentLogId,
                                PaymentLogStatusEnum.ACTIVE.name(),
                                (String) response.getResponseData().get("paymentStatus"),
                                JsonUtil.toJson(Map.of(
                                                "response", response,
                                                "originalRequest", request)));
=======
                // Update payment log with response
                updatePaymentLogHelper(paymentLogId, response, request);
>>>>>>> 3844d717f (fix:paymentService changes added)

                return response;
        }

        /**
<<<<<<< HEAD
         * Handles payment for UserPlan with UserDTO (auto-renewal scenarios).
         * This method is used when we have both UserDTO and UserPlan available,
         * such as in subscription auto-renewal flows.
         * 
         * NOTE: Does NOT reuse OrderId and does NOT send notifications
         * as it's for automated backend processes, not user-initiated payments.
         * 
=======
         * Handles payment for UserPlan with UserDTO (for auto-renewal scenarios).
         * This method is used when we have both UserDTO and UserPlan available,
         * such as in subscription auto-renewal flows.
         * 
>>>>>>> 3844d717f (fix:paymentService changes added)
         * @param request     Payment initiation request with all payment details
         * @param instituteId Institute ID for payment processing
         * @param user        UserDTO of the user making the payment (ROOT_ADMIN for SubOrg)
         * @param userPlan    UserPlan associated with this payment
         * @return PaymentResponseDTO with payment result
         */
        public PaymentResponseDTO handlePaymentWithUser(PaymentInitiationRequestDTO request,
                        String instituteId,
                        UserDTO user,
                        UserPlan userPlan) {

<<<<<<< HEAD
                // Always create new payment log (no OrderId reuse for auto-renewal)
                String paymentLogId = paymentLogService.createPaymentLog(
=======
                // Create payment log for the user plan
                String paymentLogId = createPaymentLogHelper(
>>>>>>> 3844d717f (fix:paymentService changes added)
                                user.getId(),
                                request.getAmount(),
                                request.getVendor(),
                                request.getVendorId(),
                                request.getCurrency(),
                                userPlan);

                request.setOrderId(paymentLogId);

<<<<<<< HEAD
=======
                // Create or get customer for the user
>>>>>>> 3844d717f (fix:paymentService changes added)
                UserInstitutePaymentGatewayMapping gatewayMapping = createOrGetCustomer(
                                instituteId,
                                user,
                                request.getVendor(),
                                request);

                paymentGatewaySpecificPaymentDetailService.configureCustomerPaymentData(
                                gatewayMapping,
                                request.getVendor(),
                                request);

<<<<<<< HEAD
=======
                // Process the payment
>>>>>>> 3844d717f (fix:paymentService changes added)
                PaymentResponseDTO response = makePayment(
                                request.getVendor(),
                                instituteId,
                                user,
                                request);

<<<<<<< HEAD
                paymentLogService.updatePaymentLog(
                                paymentLogId,
                                PaymentLogStatusEnum.ACTIVE.name(),
                                (String) response.getResponseData().get("paymentStatus"),
                                JsonUtil.toJson(Map.of(
                                                "response", response,
                                                "originalRequest", request)));
=======
                // Update payment log with response
                updatePaymentLogHelper(paymentLogId, response, request);
>>>>>>> 3844d717f (fix:paymentService changes added)

                return response;
        }

        /**
<<<<<<< HEAD
         * Checks payment status for PhonePe payments.
         * Updates payment log based on status (COMPLETED/FAILED).
         * 
         * @param vendor      Payment gateway vendor
         * @param instituteId Institute ID
         * @param orderId     Order/Payment log ID
         * @return Status map with state and details
         */
        public Map<String, Object> checkPaymentStatus(String vendor, String instituteId, String orderId) {
                Map<String, Object> paymentGatewaySpecificData = institutePaymentGatewayMappingService
                                .findInstitutePaymentGatewaySpecifData(vendor, instituteId);
                PaymentServiceStrategy paymentServiceStrategy = paymentServiceFactory
                                .getStrategy(PaymentGateway.fromString(vendor));

                if (paymentServiceStrategy instanceof PhonePePaymentManager) {
                        PhonePeStatusResponseDTO status = ((PhonePePaymentManager) paymentServiceStrategy)
                                        .checkPaymentStatus(orderId, paymentGatewaySpecificData);

                        Map<String, Object> responseMap = new HashMap<>();
                        responseMap.put("status", status.getState());
                        responseMap.put("details", status);

                        // Update payment log based on status
                        if ("COMPLETED".equalsIgnoreCase(status.getState())) {
                                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.PAID.name(), instituteId);
                        } else if ("FAILED".equalsIgnoreCase(status.getState())) {
                                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.FAILED.name(),
                                                instituteId);
                        }

                        return responseMap;
                }

                throw new UnsupportedOperationException("Status check not supported for " + vendor);
        }

=======
         * Initiates payment through the configured payment gateway.
         */
>>>>>>> 3844d717f (fix:paymentService changes added)
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

                PaymentServiceStrategy paymentServiceStrategy = paymentServiceFactory
                                .getStrategy(PaymentGateway.fromString(vendor));

                Map<String, Object> existingCustomer = paymentServiceStrategy.findCustomerByEmail(email,
                                paymentGatewaySpecificData);
                if (existingCustomer != null && existingCustomer.containsKey("customerId")) {
                        return existingCustomer;
                }

                return paymentServiceStrategy.createCustomerForUnknownUser(email,
                                request, paymentGatewaySpecificData);
        }

<<<<<<< HEAD
=======
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
                                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.PAID.name(), instituteId);
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
>>>>>>> 3844d717f (fix:paymentService changes added)
        private UserDTO getUserById(String userId) {
                List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(userId));
                if (users.isEmpty()) {
                        throw new RuntimeException("User not found with ID: " + userId);
                }
                return users.get(0);
        }
<<<<<<< HEAD
=======

        /**
         * Helper method to create payment log with consistent parameters.
         */
        private String createPaymentLogHelper(String userId, Double amount, String vendor, String vendorId,
                        String currency, UserPlan userPlan) {
                return paymentLogService.createPaymentLog(
                                userId,
                                amount,
                                vendor,
                                vendorId,
                                currency,
                                userPlan);
        }

        /**
         * Helper method to update payment log with response data.
         */
        private void updatePaymentLogHelper(String paymentLogId, PaymentResponseDTO response,
                        PaymentInitiationRequestDTO request) {
                paymentLogService.updatePaymentLog(
                                paymentLogId,
                                PaymentLogStatusEnum.ACTIVE.name(),
                                (String) response.getResponseData().get("paymentStatus"),
                                JsonUtil.toJson(Map.of(
                                                "response", response,
                                                "originalRequest", request)));
        }
>>>>>>> 3844d717f (fix:paymentService changes added)
}