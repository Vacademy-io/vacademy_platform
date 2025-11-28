package vacademy.io.admin_core_service.features.audience.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.audience.dto.*;
import vacademy.io.admin_core_service.features.audience.service.AudienceService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * REST Controller for Audience Management
 * Endpoints for campaign creation, lead management, and reporting
 */
@RestController
@RequestMapping("/admin-core-service/v1/audience")
public class AudienceController {

    @Autowired
    private AudienceService audienceService;

    @PostMapping("/campaign")
    public ResponseEntity<String> createCampaign(
            @RequestBody AudienceDTO audienceDTO,
            @RequestAttribute("user") CustomUserDetails user) {
        
        // Set created by user
        if (audienceDTO.getCreatedByUserId() == null) {
            audienceDTO.setCreatedByUserId(user.getUserId());
        }

        String campaignId = audienceService.createCampaign(audienceDTO);
        return ResponseEntity.ok(campaignId);
    }

    @PutMapping("/campaign/{audienceId}")
    public ResponseEntity<String> updateCampaign(
            @PathVariable String audienceId,
            @RequestBody AudienceDTO audienceDTO,
            @RequestAttribute("user") CustomUserDetails user) {

        String updatedId = audienceService.updateCampaign(audienceId, audienceDTO);
        return ResponseEntity.ok(updatedId);
    }

    @PostMapping("/campaigns")
    public ResponseEntity<Page<AudienceDTO>> getCampaigns(
            @RequestBody AudienceFilterDTO filterDTO,
            @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(name = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {

        // Set pagination from request params
        if (filterDTO.getPage() == null) {
            filterDTO.setPage(pageNo);
        }
        if (filterDTO.getSize() == null) {
            filterDTO.setSize(pageSize);
        }

        Page<AudienceDTO> campaigns = audienceService.getCampaigns(filterDTO);
        return ResponseEntity.ok(campaigns);
    }

    @DeleteMapping("/campaign/{instituteId}/{audienceId}")
    public ResponseEntity<String> deleteCampaign(
            @PathVariable String instituteId,
            @PathVariable String audienceId) {

        audienceService.deleteCampaign(audienceId, instituteId);
        return ResponseEntity.ok("Campaign deleted successfully");
    }

    @PostMapping("/leads")
    public ResponseEntity<Page<LeadDetailDTO>> getLeads(
            @RequestBody LeadFilterDTO filterDTO,
            @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(name = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {

        // Set pagination from request params
        if (filterDTO.getPage() == null) {
            filterDTO.setPage(pageNo);
        }
        if (filterDTO.getSize() == null) {
            filterDTO.setSize(pageSize);
        }

        Page<LeadDetailDTO> leads = audienceService.getLeads(filterDTO);
        return ResponseEntity.ok(leads);
    }

    @GetMapping("/lead/{responseId}")
    public ResponseEntity<LeadDetailDTO> getLeadById(@PathVariable String responseId) {
        LeadDetailDTO lead = audienceService.getLeadById(responseId);
        return ResponseEntity.ok(lead);
    }
}

