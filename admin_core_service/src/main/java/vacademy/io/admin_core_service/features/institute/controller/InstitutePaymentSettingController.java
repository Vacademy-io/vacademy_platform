package vacademy.io.admin_core_service.features.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;

import java.util.List;
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

    @GetMapping("/vendors")
    public ResponseEntity<List<Map<String, String>>> getVendorsForInstitute(
            @RequestParam String instituteId) {
        List<InstitutePaymentGatewayMappingService.VendorInfo> vendors =
                institutePaymentGatewayMappingService.getAllVendorsForInstitute(instituteId);
        List<Map<String, String>> response = vendors.stream()
                .map(v -> Map.of("vendor", v.getVendor(), "vendor_id", v.getVendorId()))
                .toList();
        return ResponseEntity.ok(response);
    }
}
