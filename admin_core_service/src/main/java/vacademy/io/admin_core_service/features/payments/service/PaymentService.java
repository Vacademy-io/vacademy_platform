package vacademy.io.admin_core_service.features.payments.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentGateway;

import java.util.Map;

@Service
public class PaymentService {

    @Autowired
    private PaymentServiceFactory paymentServiceFactory;

    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    public PaymentResponseDTO makePayment(String vendor, String instituteId, PaymentInitiationRequestDTO request) {
        Map<String, Object> paymentGatewaySpecificData = institutePaymentGatewayMappingService.findByVendorAndInstituteId(vendor, instituteId);
        PaymentServiceStrategy paymentServiceStrategy = paymentServiceFactory.getStrategy(PaymentGateway.fromString(vendor));
        return paymentServiceStrategy.initiatePayment(request, paymentGatewaySpecificData);
    }

}
