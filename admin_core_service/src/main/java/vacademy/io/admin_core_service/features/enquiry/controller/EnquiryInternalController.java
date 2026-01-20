package vacademy.io.admin_core_service.features.enquiry.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
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
}
