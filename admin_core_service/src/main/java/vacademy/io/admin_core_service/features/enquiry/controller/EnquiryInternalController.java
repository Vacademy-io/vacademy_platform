package vacademy.io.admin_core_service.features.enquiry.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.enquiry.dto.AdminEnquiryDetailResponseDTO;
import vacademy.io.admin_core_service.features.enquiry.dto.BulkEnquiryStatusUpdateRequestDTO;
import vacademy.io.admin_core_service.features.enquiry.dto.BulkEnquiryStatusUpdateResponseDTO;
import vacademy.io.admin_core_service.features.enquiry.dto.LinkCounselorDTO;
import vacademy.io.admin_core_service.features.enquiry.service.EnquiryService;

@RestController
@RequestMapping("/admin-core-service/enquiry")
public class EnquiryInternalController {

    @Autowired
    private EnquiryService enquiryService;

    @PostMapping("/link-counselor")
    public ResponseEntity<String> linkCounselor(@RequestBody LinkCounselorDTO request) {
        String response = enquiryService.linkCounselorToSource(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/v1/admin/details")
    public ResponseEntity<AdminEnquiryDetailResponseDTO> getAdminEnquiryDetails(
            @RequestParam String enquiryId) {
        AdminEnquiryDetailResponseDTO response = enquiryService.getAdminEnquiryDetails(enquiryId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/v1/admin/update-status")
    public ResponseEntity<BulkEnquiryStatusUpdateResponseDTO> bulkUpdateEnquiryStatus(
            @RequestBody BulkEnquiryStatusUpdateRequestDTO request) {
        BulkEnquiryStatusUpdateResponseDTO response = enquiryService.bulkUpdateEnquiryStatus(request);
        return ResponseEntity.ok(response);
    }
}
