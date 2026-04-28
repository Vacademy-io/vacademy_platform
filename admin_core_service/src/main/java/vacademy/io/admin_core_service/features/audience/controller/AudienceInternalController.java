package vacademy.io.admin_core_service.features.audience.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.audience.dto.AudienceOptOutRequestDTO;
import vacademy.io.admin_core_service.features.audience.dto.BatchPhoneNumberRequest;
import vacademy.io.admin_core_service.features.audience.dto.UserWithCustomFieldsDTO;
import vacademy.io.admin_core_service.features.audience.service.AudienceOptOutService;
import vacademy.io.admin_core_service.features.audience.service.AudienceService;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/internal")
public class AudienceInternalController {

    @Autowired
    private AudienceService audienceService;

    @Autowired
    private AudienceOptOutService audienceOptOutService;
    /**
     * Get converted user IDs for a campaign (for notification service)
     * Used to resolve AUDIENCE recipient type in announcements
     */
    @GetMapping("/campaign/{instituteId}/{audienceId}/users")
    public ResponseEntity<List<String>> getConvertedUsersByCampaign(
            @PathVariable String instituteId,
            @PathVariable String audienceId) {

        List<String> userIds = audienceService.getConvertedUserIdsByCampaign(audienceId, instituteId);
        return ResponseEntity.ok(userIds);
    }

    /**
     * Get user details by phone number from custom field values
     * Searches in custom_field_values table and returns complete user with all custom fields
     * 
     * Example: GET /admin-core-service/internal/user/by-phone?phoneNumber=+916263442911
     * 
     * @param phoneNumber Phone number to search for
     * @return UserWithCustomFieldsDTO containing complete user details and custom fields
     */
    @GetMapping("/user/by-phone")
    public ResponseEntity<UserWithCustomFieldsDTO> getUserByPhoneNumber(
            @RequestParam("phoneNumber") String phoneNumber) {
        
        UserWithCustomFieldsDTO response = audienceService.getUserByPhoneNumber(phoneNumber);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/users/by-phones")
    public ResponseEntity<List<UserWithCustomFieldsDTO>> getUsersByPhoneNumbers(
            @RequestBody BatchPhoneNumberRequest request) {

        List<UserWithCustomFieldsDTO> response = audienceService.getUsersByPhoneNumbers(request.getPhoneNumbers());
        return ResponseEntity.ok(response);
    }

    /**
     * Called by notification_service when a user opts out via WhatsApp STOP or email unsubscribe.
     * Soft-deletes their most-recent active audience_response and adds them to the opt-out audience.
     */
    @PostMapping("/audience/opt-out")
    public ResponseEntity<Void> handleUserOptOut(@RequestBody AudienceOptOutRequestDTO request) {
        audienceOptOutService.moveUserToOptOutAudience(
                request.getUserId(), request.getInstituteId(), request.getChannel());
        return ResponseEntity.ok().build();
    }

}
