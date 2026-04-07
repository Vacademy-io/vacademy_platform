package vacademy.io.admin_core_service.features.audience.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.audience.dto.*;
import vacademy.io.admin_core_service.features.audience.service.AudienceService;
import vacademy.io.admin_core_service.features.audience.service.UserLeadProfileService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for Audience Management
 * Endpoints for campaign creation, lead management, and reporting
 */
@RestController
@RequestMapping("/admin-core-service/v1/audience")
public class AudienceController {

    @Autowired
    private AudienceService audienceService;

    @Autowired
    private UserLeadProfileService userLeadProfileService;

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

    @DeleteMapping("/lead/{responseId}")
    public ResponseEntity<String> deleteLead(@PathVariable String responseId) {
        audienceService.deleteLead(responseId);
        return ResponseEntity.ok("Lead deleted successfully");
    }

    /**
     * Send a message to audience campaign leads.
     */
    @PostMapping("/campaign/{audienceId}/send")
    public ResponseEntity<SendAudienceMessageResponseDTO> sendMessage(
            @PathVariable String audienceId,
            @RequestBody SendAudienceMessageRequestDTO request) {
        request.setAudienceId(audienceId);
        SendAudienceMessageResponseDTO response = audienceService.sendAudienceMessage(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Get communication history for a campaign.
     */
    @GetMapping("/campaign/{audienceId}/communications")
    public ResponseEntity<Page<AudienceCommunicationDTO>> getCommunications(
            @PathVariable String audienceId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<AudienceCommunicationDTO> communications = audienceService.getCommunications(audienceId, page, size);
        return ResponseEntity.ok(communications);
    }

    @PostMapping("/enquiries")
    public ResponseEntity<Page<EnquiryWithResponseDTO>> getEnquiries(
            @RequestBody EnquiryListFilterDTO filterDTO,
            @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(name = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {
        
        // Set pagination from request params if not provided in body
        if (filterDTO.getPage() == null) {
            filterDTO.setPage(pageNo);
        }
        if (filterDTO.getSize() == null) {
            filterDTO.setSize(pageSize);
        }
        
        Page<EnquiryWithResponseDTO> enquiries = audienceService.getEnquiriesWithResponses(filterDTO);
        return ResponseEntity.ok(enquiries);
    }

    // ── Walk-In Registration ──────────────────────────────

    /**
     * Register a walk-in lead. Simplified form for events/fairs.
     * Auto-sets sourceType to WALK_IN and assigns the logged-in user as counselor.
     * POST /admin-core-service/v1/audience/walk-in/submit
     */
    @PostMapping("/walk-in/submit")
    public ResponseEntity<SubmitLeadWithEnquiryResponseDTO> submitWalkIn(
            @RequestBody WalkInRegistrationDTO walkInDTO,
            @RequestAttribute("user") CustomUserDetails user) {

        SubmitLeadWithEnquiryResponseDTO response = audienceService.submitWalkIn(walkInDTO, user);
        return ResponseEntity.ok(response);
    }

    // ── Lead Score ────────────────────────────────────────

    /**
     * Get lead score details for a specific lead.
     * GET /admin-core-service/v1/audience/lead/{responseId}/score
     */
    @GetMapping("/lead/{responseId}/score")
    public ResponseEntity<LeadScoreDTO> getLeadScore(@PathVariable String responseId) {
        LeadScoreDTO score = audienceService.getLeadScore(responseId);
        return ResponseEntity.ok(score);
    }

    /**
     * Force recalculate all lead scores for a campaign.
     * POST /admin-core-service/v1/audience/campaign/{audienceId}/recalculate-scores
     */
    @PostMapping("/campaign/{audienceId}/recalculate-scores")
    public ResponseEntity<String> recalculateScores(@PathVariable String audienceId) {
        audienceService.recalculateScoresForAudience(audienceId);
        return ResponseEntity.ok("Scores recalculated for campaign: " + audienceId);
    }

    /**
     * Get aggregated lead profile for a specific user.
     * GET /admin-core-service/v1/audience/user-lead-profile?userId=...&instituteId=...
     */
    @GetMapping("/user-lead-profile")
    public ResponseEntity<?> getUserLeadProfile(
            @RequestParam String userId,
            @RequestParam String instituteId) {
        return userLeadProfileService.getProfileDTO(userId, instituteId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Manually mark a user's lead as CONVERTED.
     * POST /admin-core-service/v1/audience/user-lead-profile/mark-converted
     */
    @PostMapping("/user-lead-profile/mark-converted")
    public ResponseEntity<UserLeadProfileDTO> markLeadConverted(
            @RequestParam String userId,
            @RequestParam String instituteId) {
        userLeadProfileService.markConverted(userId, instituteId);
        return ResponseEntity.ok(userLeadProfileService.getProfileDTO(userId, instituteId).orElse(null));
    }

    /**
     * Batch fetch lead profiles for a list of user IDs.
     * POST /admin-core-service/v1/audience/user-lead-profiles/batch
     * Body: ["userId1", "userId2", ...]
     * Returns: { "userId1": { ...profile }, "userId2": { ...profile } }
     */
    @PostMapping("/user-lead-profiles/batch")
    public ResponseEntity<Map<String, UserLeadProfileDTO>> getBatchLeadProfiles(
            @RequestBody List<String> userIds) {
        return ResponseEntity.ok(userLeadProfileService.getProfilesForUsers(userIds));
    }

    /**
     * Get all audience/campaign memberships for a user.
     * GET /admin-core-service/v1/audience/user-audiences?userId=...
     */
    @GetMapping("/user-audiences")
    public ResponseEntity<List<UserAudienceMembershipDTO>> getUserAudiences(
            @RequestParam String userId) {
        return ResponseEntity.ok(userLeadProfileService.getUserAudienceMemberships(userId));
    }
}

