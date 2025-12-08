package vacademy.io.admin_core_service.features.payments.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentGatewaySpecificPaymentDetailService;
import vacademy.io.admin_core_service.features.notification_service.service.PaymentNotificatonService;
import vacademy.io.admin_core_service.features.payments.manager.PaymentServiceFactory;
import vacademy.io.admin_core_service.features.payments.manager.PaymentServiceStrategy;
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
import vacademy.io.common.payment.enums.PaymentGateway;

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

        public PaymentResponseDTO handlePayment(UserDTO user,
                        LearnerPackageSessionsEnrollDTO enrollDTO,
                        String instituteId,
                        EnrollInvite enrollInvite,
                        UserPlan userPlan) {

                PaymentInitiationRequestDTO request = enrollDTO.getPaymentInitiationRequest();
                String paymentLogId = paymentLogService.createPaymentLog(
                                user.getId(),
                                request.getAmount(),
                                enrollInvite.getVendor(),
                                enrollInvite.getVendorId(),
                                enrollInvite.getCurrency(),
                                userPlan);

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

                PaymentResponseDTO response = makePayment(
                                enrollInvite.getVendor(),
                                instituteId,
                                user,
                                request);

                paymentLogService.updatePaymentLog(
                                paymentLogId,
                                PaymentLogStatusEnum.ACTIVE.name(),
                                (String) response.getResponseData().get("paymentStatus"),
                                JsonUtil.toJson(Map.of(
                                                "response", response,
                                                "originalRequest", request)));

                return response;
        }

        public PaymentResponseDTO handlePayment(PaymentInitiationRequestDTO request,
                        String instituteId) {

                String paymentLogId = paymentLogService.createPaymentLog(
                                null,
                                request.getAmount(),
                                request.getVendor(),
                                request.getVendorId(),
                                request.getCurrency(),
                                null);

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

                paymentLogService.updatePaymentLog(
                                paymentLogId,
                                PaymentLogStatusEnum.ACTIVE.name(),
                                (String) response.getResponseData().get("paymentStatus"),
                                JsonUtil.toJson(Map.of(
                                                "response", response,
                                                "originalRequest", request)));

                return response;
        }

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
                String paymentLogId = paymentLogService.createPaymentLog(
                                userId,
                                request.getAmount(),
                                request.getVendor(),
                                request.getVendorId(),
                                request.getCurrency(),
                                userPlan);

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
                paymentLogService.updatePaymentLog(
                                paymentLogId,
                                PaymentLogStatusEnum.ACTIVE.name(),
                                (String) response.getResponseData().get("paymentStatus"),
                                JsonUtil.toJson(Map.of(
                                                "response", response,
                                                "originalRequest", request)));

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
                String paymentLogId = paymentLogService.createPaymentLog(
                                user.getId(),
                                request.getAmount(),
                                request.getVendor(),
                                request.getVendorId(),
                                request.getCurrency(),
                                userPlan);

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
                paymentLogService.updatePaymentLog(
                                paymentLogId,
                                PaymentLogStatusEnum.ACTIVE.name(),
                                (String) response.getResponseData().get("paymentStatus"),
                                JsonUtil.toJson(Map.of(
                                                "response", response,
                                                "originalRequest", request)));

                return response;
        }

        public PaymentResponseDTO makePayment(String vendor, String instituteId, UserDTO user,
                        PaymentInitiationRequestDTO request) {
                Map<String, Object> paymentGatewaySpecificData = institutePaymentGatewayMappingService
                                .findInstitutePaymentGatewaySpecifData(vendor, instituteId);
                PaymentServiceStrategy paymentServiceStrategy = paymentServiceFactory
                                .getStrategy(PaymentGateway.fromString(vendor));
                request.setInstituteId(instituteId);
                return paymentServiceStrategy.initiatePayment(user, request, paymentGatewaySpecificData);
        }

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

        private UserDTO getUserById(String userId) {
                // Get user details from auth service
                List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(userId));
                if (users.isEmpty()) {
                        throw new RuntimeException("User not found with ID: " + userId);
                }
                return users.get(0);
        }
}
