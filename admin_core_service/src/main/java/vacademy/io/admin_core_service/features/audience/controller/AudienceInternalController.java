package vacademy.io.admin_core_service.features.audience.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
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

}
