package vacademy.io.admin_core_service.features.payments.service;


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
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentGateway;

import java.util.Map;
import java.util.Optional;

@Service
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
                userPlan
        );

        request.setOrderId(paymentLogId);

        UserInstitutePaymentGatewayMapping gatewayMapping = createOrGetCustomer(
                instituteId,
                user,
                enrollInvite.getVendor(),
                request
        );

        paymentGatewaySpecificPaymentDetailService.configureCustomerPaymentData(
                gatewayMapping,
                enrollInvite.getVendor(),
                request
        );

        PaymentResponseDTO response = makePayment(
                enrollInvite.getVendor(),
                instituteId,
                user,
                request
        );

        paymentNotificatonService.sendPaymentNotification(
                instituteId,
                response,
                request,
                user,
                enrollInvite.getVendor()
        );

        paymentLogService.updatePaymentLog(
                paymentLogId,
                PaymentLogStatusEnum.ACTIVE.name(),
                (String) response.getResponseData().get("paymentStatus"),
                JsonUtil.toJson(response)
        );

        return response;
    }

    public PaymentResponseDTO makePayment(String vendor, String instituteId, UserDTO user, PaymentInitiationRequestDTO request) {
        Map<String, Object> paymentGatewaySpecificData = institutePaymentGatewayMappingService.findInstitutePaymentGatewaySpecifData(vendor, instituteId);
        PaymentServiceStrategy paymentServiceStrategy = paymentServiceFactory.getStrategy(PaymentGateway.fromString(vendor));
        request.setInstituteId(instituteId);
        return paymentServiceStrategy.initiatePayment(user,request, paymentGatewaySpecificData);
    }

    public UserInstitutePaymentGatewayMapping createOrGetCustomer(String instituteId,UserDTO user,String vendor, PaymentInitiationRequestDTO request) {
        Map<String, Object> paymentGatewaySpecificData = institutePaymentGatewayMappingService.findInstitutePaymentGatewaySpecifData(vendor, instituteId);
        Optional<UserInstitutePaymentGatewayMapping>optionalUserInstitutePaymentGatewayMapping = userInstitutePaymentGatewayMappingService.findByUserIdAndInstituteId(user.getId(),instituteId,vendor);
        if (optionalUserInstitutePaymentGatewayMapping.isPresent()){
            return optionalUserInstitutePaymentGatewayMapping.get();
        }
        PaymentServiceStrategy paymentServiceStrategy = paymentServiceFactory.getStrategy(PaymentGateway.fromString(vendor));
        Map<String, Object> gatewayCustomerIdAndDataMap = paymentServiceStrategy.createCustomer(user, request, paymentGatewaySpecificData);
        return userInstitutePaymentGatewayMappingService.saveUserInstituteVendorMapping(
                user.getId(),
                instituteId,
                vendor,
                (String) gatewayCustomerIdAndDataMap.get("customerId"),
                gatewayCustomerIdAndDataMap
                );
    }

}
