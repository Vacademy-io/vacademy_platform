package vacademy.io.admin_core_service.features.audience.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.audience.dto.AudienceDTO;
import vacademy.io.admin_core_service.features.audience.dto.SubmitLeadRequestDTO;
import vacademy.io.admin_core_service.features.audience.service.AudienceService;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;


/**
 * Public REST Controller for Audience Management
 * Open endpoints (no authentication) for form submissions from websites
 */
@RestController
@RequestMapping("/admin-core-service/open/v1/audience")
public class PublicAudienceController {

    @Autowired
    private AudienceService audienceService;

    @Autowired
    private InstituteCustomFiledService instituteCustomFiledService;

    /**
     * Submit a lead from website form (public endpoint)
     * POST /open/v1/audience/lead/submit
     */
    @PostMapping("/lead/submit")
    public ResponseEntity<String> submitLead(@RequestBody SubmitLeadRequestDTO requestDTO) {
        String responseId = audienceService.submitLead(requestDTO);
        return ResponseEntity.ok(responseId);
    }

    /**
     * Submit a lead from website form with workflow integration (v2)
     * POST /open/v1/audience/lead/submit/v2
     * Email sending is handled by workflow engine
     */
    @PostMapping("/lead/submit/v2")
    public ResponseEntity<String> submitLeadV2(@RequestBody SubmitLeadRequestDTO requestDTO) {
        String responseId = audienceService.submitLeadV2(requestDTO);
        return ResponseEntity.ok(responseId);
    }

    @GetMapping("/campaign/{instituteId}/{audienceId}")
    public ResponseEntity<AudienceDTO> getCampaign(
            @PathVariable String instituteId,
            @PathVariable String audienceId) {

        AudienceDTO campaign = audienceService.getCampaignById(audienceId, instituteId);
        return ResponseEntity.ok(campaign);
    }
}

