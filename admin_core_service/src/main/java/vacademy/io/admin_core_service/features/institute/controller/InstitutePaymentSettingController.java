package vacademy.io.admin_core_service.features.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;

import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/open/v1/institute/payment-setting")
public class InstitutePaymentSettingController {
    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    @GetMapping("/payment-gateway-details")
    public ResponseEntity<Map<String, Object>> getPaymentGatewayOpenDetails(String instituteId, String vendor) {
        return ResponseEntity.ok(institutePaymentGatewayMappingService.getPaymentGatewayOpenDetails(instituteId,vendor));
    }
}
