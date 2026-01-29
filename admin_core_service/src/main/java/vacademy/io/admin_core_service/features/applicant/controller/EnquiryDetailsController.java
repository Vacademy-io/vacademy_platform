package vacademy.io.admin_core_service.features.applicant.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.applicant.dto.EnquiryDetailsResponseDTO;
import vacademy.io.admin_core_service.features.applicant.service.ApplicantService;
import vacademy.io.common.exceptions.VacademyException;

/**
 * Controller for fetching enquiry details for application form pre-fill
 */
@RestController
@RequestMapping("/admin-core-service/applicant/v1/enquiry")
@RequiredArgsConstructor
public class EnquiryDetailsController {

    private final ApplicantService applicantService;

    /**
     * Get enquiry details for form pre-fill
     * Can search by enquiryId OR phone (not both)
     * 
     * @param enquiryId Enquiry UUID (optional)
     * @param phone     Parent phone number (optional)
     * @return EnquiryDetailsResponseDTO with parent and child info
     */
    @GetMapping("/details")
    public ResponseEntity<EnquiryDetailsResponseDTO> getEnquiryDetails(
            @RequestParam(required = false) String enquiryId,
            @RequestParam(required = false) String phone) {

        if (enquiryId == null && phone == null) {
            throw new VacademyException("Please provide either enquiryId or phone");
        }

        EnquiryDetailsResponseDTO response;

        if (enquiryId != null) {
            response = applicantService.getEnquiryDetailsByEnquiryId(enquiryId);
        } else {
            response = applicantService.getEnquiryDetailsByPhone(phone);
        }

        return ResponseEntity.ok(response);
    }
}
