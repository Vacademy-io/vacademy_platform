package vacademy.io.admin_core_service.features.user_subscription.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserInstitutePaymentGatewayMappingRepository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class UserInstitutePaymentGatewayMappingService {

    @Autowired
    private UserInstitutePaymentGatewayMappingRepository userInstitutePaymentGatewayMappingRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    public Optional<UserInstitutePaymentGatewayMapping> findByUserIdAndInstituteId(String userId, String instituteId,String vendorId) {
        return userInstitutePaymentGatewayMappingRepository.findByUserIdAndInstituteIdAndVendorAndStatuses(userId,instituteId,vendorId, List.of(StatusEnum.ACTIVE.name()),List.of(StatusEnum.ACTIVE.name()));
    }

    public UserInstitutePaymentGatewayMapping saveUserInstituteVendorMapping(String userId, String instituteId,
            String vendor,
            String paymentGatewayCustomerId,
            Object paymentGatewaySpecificData) {
        System.out.println(paymentGatewaySpecificData);
        UserInstitutePaymentGatewayMapping mapping = new UserInstitutePaymentGatewayMapping();
        mapping.setUserId(userId);
        mapping.setInstitutePaymentGatewayMapping(
                institutePaymentGatewayMappingService.findByInstituteIdAndVendor(instituteId, vendor));
        mapping.setPaymentGatewayCustomerId(paymentGatewayCustomerId);
        mapping.setStatus(StatusEnum.ACTIVE.name());

        try {
            String jsonData = objectMapper.writeValueAsString(paymentGatewaySpecificData);
            mapping.setPaymentGatewayCustomerData(jsonData);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize payment gateway data to JSON", e);
        }

        return userInstitutePaymentGatewayMappingRepository.save(mapping);
    }
}
