package vacademy.io.admin_core_service.features.institute.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.institute.entity.InstitutePaymentGatewayMapping;
import vacademy.io.admin_core_service.features.institute.repository.InstitutePaymentGatewayMappingRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.enums.PaymentGateway;

import java.util.List;
import java.util.Map;

@Service
public class InstitutePaymentGatewayMappingService {
    @Autowired
    private InstitutePaymentGatewayMappingRepository institutePaymentGatewayMappingRepository;

    @Autowired
    private ObjectMapper objectMapper;

    public Map<String, Object> findInstitutePaymentGatewaySpecifData(String vendor, String instituteId) {
        InstitutePaymentGatewayMapping institutePaymentGatewayMapping = institutePaymentGatewayMappingRepository.findByInstituteIdAndVendorAndStatusIn(instituteId, vendor, List.of(StatusEnum.ACTIVE.name())).orElseThrow(()->new VacademyException("No configurartion found for this payment gateway type"));
        return convertJsonToMap(institutePaymentGatewayMapping.getPaymentGatewaySpecificData());
    }

    public InstitutePaymentGatewayMapping findByInstituteIdAndVendor(String instituteId, String vendor) {
        return institutePaymentGatewayMappingRepository.findByInstituteIdAndVendorAndStatusIn(instituteId, vendor, List.of(StatusEnum.ACTIVE.name())).orElseThrow(()->new VacademyException("No configurartion found for this payment gateway type"));
    }

    private Map<String, Object> convertJsonToMap(String json) {
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            throw new VacademyException("Failed to convert JSON to map");
        }
    }

    public Map<String,Object>getPaymentGatewayOpenDetails(String instituteId,String vendor) {
        Map<String, Object> paymentGatewaySpecificData = findInstitutePaymentGatewaySpecifData(vendor, instituteId);
        PaymentGateway paymentGateway = PaymentGateway.fromString(vendor);
        switch (paymentGateway) {
            case STRIPE:
                return stripePaymentGatewayOpenDetails(paymentGatewaySpecificData);
            default:
                throw new IllegalArgumentException("Unsupported payment gateway: " + vendor);
        }
    }

    private Map<String,Object>stripePaymentGatewayOpenDetails(Map<String, Object>paymentGatwwaySpecificData) {
        return Map.of("publishableKey",paymentGatwwaySpecificData.get("publishableKey"));
    }
}
