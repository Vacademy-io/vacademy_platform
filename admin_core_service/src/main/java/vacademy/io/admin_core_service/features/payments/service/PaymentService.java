package vacademy.io.admin_core_service.features.payments.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.payments.manager.PaymentServiceFactory;
import vacademy.io.admin_core_service.features.payments.manager.PaymentServiceStrategy;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping;
import vacademy.io.admin_core_service.features.user_subscription.service.UserInstitutePaymentGatewayMappingService;
import vacademy.io.common.auth.dto.UserDTO;
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
