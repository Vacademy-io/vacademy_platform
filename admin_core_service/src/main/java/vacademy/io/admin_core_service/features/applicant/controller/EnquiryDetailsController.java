package vacademy.io.admin_core_service.features.applicant.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.applicant.dto.EnquiryDetailsResponseDTO;
import java.util.List;

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
     * Can search by enquiryId OR enquiryTrackingId OR phone (not multiple)
     * 
     * @param enquiryId         Enquiry UUID (optional)
     * @param enquiryTrackingId Enquiry Tracking ID (optional)
     * @param phone             Parent phone number (optional)
     * @return EnquiryDetailsResponseDTO with parent and child info
     */
    @GetMapping("/details")
    public ResponseEntity<EnquiryDetailsResponseDTO> getEnquiryDetails(
            @RequestParam(required = false) String enquiryId,
            @RequestParam(required = false) String enquiryTrackingId,
            @RequestParam(required = false) String phone) {

        if (enquiryId == null && enquiryTrackingId == null && phone == null) {
            throw new VacademyException("Please provide either enquiryId, enquiryTrackingId, or phone");
        }

        EnquiryDetailsResponseDTO response;

        if (enquiryId != null) {
            response = applicantService.getEnquiryDetailsByEnquiryId(enquiryId);
        } else if (enquiryTrackingId != null) {
            response = applicantService.getEnquiryDetailsByTrackingId(enquiryTrackingId);
        } else {
            response = applicantService.getEnquiryDetailsByPhone(phone);
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Search for enquiries returning a list of matched records
     * Helps with finding multiple children under one parent or searching by name
     *
     * @param instituteId       Institute ID for data isolation (required)
     * @param name              Parent name (partial match)
     * @param phone             Parent phone number
     * @param enquiryTrackingId Enquiry Tracking ID
     * @return List of EnquiryDetailsResponseDTO
     */
    @GetMapping("/search")
    public ResponseEntity<List<EnquiryDetailsResponseDTO>> searchEnquiries(
            @RequestParam String instituteId,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String enquiryTrackingId) {

        if (name == null && phone == null && enquiryTrackingId == null) {
            throw new VacademyException("Please provide either name, phone, or enquiryTrackingId for searching");
        }

        List<EnquiryDetailsResponseDTO> response = applicantService.searchEnquiries(instituteId, name, phone, enquiryTrackingId);

        return ResponseEntity.ok(response);
    }
}
