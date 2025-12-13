package vacademy.io.admin_core_service.features.audience.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.audience.dto.UserWithCustomFieldsDTO;
import vacademy.io.admin_core_service.features.audience.service.AudienceService;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/internal")
public class AudienceInternalController {

    @Autowired
    private AudienceService audienceService;
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

}
