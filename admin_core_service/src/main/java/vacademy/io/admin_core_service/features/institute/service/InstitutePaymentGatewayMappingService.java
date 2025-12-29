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
        System.out.println("=== PAYMENT GATEWAY CONFIG QUERY ===");
        System.out.println("Vendor: [" + vendor + "]");
        System.out.println("Institute ID: [" + instituteId + "]");
        System.out.println("Status: [" + StatusEnum.ACTIVE.name() + "]");
        System.out.println("====================================");

        InstitutePaymentGatewayMapping institutePaymentGatewayMapping = institutePaymentGatewayMappingRepository
                .findByInstituteIdAndVendorAndStatusIn(instituteId, vendor, List.of(StatusEnum.ACTIVE.name()))
                .orElseThrow(() -> {
                    System.out.println("!!! QUERY FAILED - No matching record found !!!");
                    return new VacademyException("No configurartion found for this payment gateway type");
                });
        return convertJsonToMap(institutePaymentGatewayMapping.getPaymentGatewaySpecificData());
    }

    public InstitutePaymentGatewayMapping findByInstituteIdAndVendor(String instituteId, String vendor) {
        return institutePaymentGatewayMappingRepository
                .findByInstituteIdAndVendorAndStatusIn(instituteId, vendor, List.of(StatusEnum.ACTIVE.name()))
                .orElseThrow(() -> new VacademyException("No configuration found for payment gateway type: " + vendor
                        + " and institute: " + instituteId));
    }

    private Map<String, Object> convertJsonToMap(String json) {
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            throw new VacademyException("Failed to convert JSON to map");
        }
    }

    public Map<String, Object> getPaymentGatewayOpenDetails(String instituteId, String vendor) {
        Map<String, Object> paymentGatewaySpecificData = findInstitutePaymentGatewaySpecifData(vendor, instituteId);
        PaymentGateway paymentGateway = PaymentGateway.fromString(vendor);
        switch (paymentGateway) {
            case STRIPE:
                return stripePaymentGatewayOpenDetails(paymentGatewaySpecificData);
            case RAZORPAY:
                return razorpayPaymentGatewayOpenDetails(paymentGatewaySpecificData);
            case EWAY:
                return ewayPaymentGatewayOpenDetails(paymentGatewaySpecificData);
            case PHONEPE:
                return phonePePaymentGatewayOpenDetails(paymentGatewaySpecificData);
            default:
                throw new IllegalArgumentException("Unsupported payment gateway: " + vendor);
        }
    }

    private Map<String, Object> phonePePaymentGatewayOpenDetails(Map<String, Object> paymentGatewaySpecificData) {
        return Map.of("clientId", paymentGatewaySpecificData.getOrDefault("clientId", ""));
    }

    private Map<String, Object> stripePaymentGatewayOpenDetails(Map<String, Object> paymentGatewaySpecificData) {
        return Map.of("publishableKey", paymentGatewaySpecificData.get("publishableKey"));
    }

    private Map<String, Object> razorpayPaymentGatewayOpenDetails(Map<String, Object> paymentGatewaySpecificData) {
        String keyId = null;
        if (paymentGatewaySpecificData != null) {
            keyId = (String) paymentGatewaySpecificData.get("apiKey");
            if (keyId == null) {
                keyId = (String) paymentGatewaySpecificData.get("keyId");
            }
        }
        return Map.of("keyId", keyId != null ? keyId : "");
    }

    private Map<String, Object> ewayPaymentGatewayOpenDetails(Map<String, Object> paymentGatewaySpecificData) {
        // safe casts to String; will be null if absent
        String encryptionKey = paymentGatewaySpecificData == null ? null
                : (String) paymentGatewaySpecificData.get("encryptionKey");
        String publicKey = paymentGatewaySpecificData == null ? null
                : (String) paymentGatewaySpecificData.get("publicKey");

        return Map.of(
                "encryptionKey", encryptionKey,
                "publicKey", publicKey);
    }
}
