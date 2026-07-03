package vacademy.io.admin_core_service.features.audience.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.audience.dto.*;
import vacademy.io.admin_core_service.features.audience.service.AudienceService;
import vacademy.io.admin_core_service.features.audience.service.LeadAssignmentNotifier;
import vacademy.io.admin_core_service.features.audience.service.UserLeadProfileService;
import vacademy.io.admin_core_service.features.timeline.enums.LeadJourneyActionType;
import vacademy.io.admin_core_service.features.timeline.service.TimelineEventService;
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

    @Autowired
    private TimelineEventService timelineEventService;

    @Autowired
    private LeadAssignmentNotifier leadAssignmentNotifier;

    /**
     * Returns the candidate counsellors a caller is allowed to assign a lead
     * to. When the institute has configured a leads_team_id AND the caller
     * is in that subtree, the picker is narrowed to the caller's user-to-user
     * descendants (themselves + reports + reports' reports). Outside that
     * gate the picker is institute-wide (admin behaviour).
     *
     * Used by the "Assign counsellor" dialogs on Recent Leads / per-campaign
     * leads / Enquiries. Replaces direct calls to /auth-service/v1/user/
     * autosuggest-users for those flows so a manager can't accidentally
     * assign a lead to someone outside their reporting chain.
     */
    @GetMapping("/eligible-assignees")
    public ResponseEntity<List<vacademy.io.common.auth.dto.UserDTO>> eligibleAssignees(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "query", required = false) String query,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(audienceService.eligibleAssignees(instituteId, query, user));
    }

    /**
     * Counsellor options for the CRM Leads "All counsellors" filter. When the institute has a
     * leads_team_id configured AND the caller is in that subtree, the list is scoped to the
     * caller's team hierarchy (themselves + reports + reports' reports) — matching the leads
     * they can actually see. Otherwise {@code scoped=false} and the frontend falls back to its
     * institute-wide counsellor list (admin behaviour). Used by the Recent Leads / per-campaign
     * leads / Follow-ups filter bars.
     */
    @GetMapping("/lead-counsellor-options")
    public ResponseEntity<LeadCounsellorOptionsDTO> leadCounsellorOptions(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(audienceService.leadCounsellorOptions(instituteId, user));
    }

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
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(name = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {

        // Set pagination from request params
        if (filterDTO.getPage() == null) {
            filterDTO.setPage(pageNo);
        }
        if (filterDTO.getSize() == null) {
            filterDTO.setSize(pageSize);
        }

        Page<AudienceDTO> campaigns = audienceService.getCampaigns(filterDTO, user);
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
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(name = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {

        // Set pagination from request params
        if (filterDTO.getPage() == null) {
            filterDTO.setPage(pageNo);
        }
        if (filterDTO.getSize() == null) {
            filterDTO.setSize(pageSize);
        }

        Page<LeadDetailDTO> leads = audienceService.getLeads(filterDTO, user);
        return ResponseEntity.ok(leads);
    }

    @GetMapping("/lead/{responseId}")
    public ResponseEntity<LeadDetailDTO> getLeadById(@PathVariable String responseId) {
        LeadDetailDTO lead = audienceService.getLeadById(responseId);
        return ResponseEntity.ok(lead);
    }

    /**
     * Distinct values a custom field actually holds across the institute's
     * leads, searchable and paginated. Powers the multi-select custom-field
     * dropdowns in the leads filter bar (e.g. listing every city leads have
     * entered into a free-text "City" field). The frontend only calls this for
     * custom fields the admin has enabled as leads filters in settings.
     */
    @GetMapping("/custom-field-values")
    public ResponseEntity<Page<String>> getLeadCustomFieldValues(
            @RequestParam("instituteId") String instituteId,
            @RequestParam("customFieldId") String customFieldId,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(name = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {
        return ResponseEntity.ok(
                audienceService.getLeadCustomFieldValues(instituteId, customFieldId, search, pageNo, pageSize));
    }

    @DeleteMapping("/lead/{responseId}")
    public ResponseEntity<String> deleteLead(@PathVariable String responseId,
                                             @RequestAttribute("user") CustomUserDetails user) {
        audienceService.deleteLead(responseId, user);
        return ResponseEntity.ok("Lead deleted successfully");
    }

    /**
     * Edit a lead's profile from the CRM. Authenticated counterpart to the
     * student edit endpoint, but writes only where a lead is read from:
     * the auth user, the audience_response guardian fields, and the lead's
     * custom field values. Keyed by the audience_response id.
     */
    @PutMapping("/lead/{responseId}/profile")
    public ResponseEntity<String> updateLeadProfile(@PathVariable String responseId,
                                                    @RequestBody LeadProfileEditRequestDTO request,
                                                    @RequestAttribute("user") CustomUserDetails user) {
        audienceService.updateLeadProfile(responseId, request);
        return ResponseEntity.ok("Lead profile updated");
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
     * Manually set (or clear) the score for a lead.
     * PUT /admin-core-service/v1/audience/lead/{responseId}/score/manual
     * Body: { "score": 75 }  — pass null to clear the override.
     */
    @PutMapping("/lead/{responseId}/score/manual")
    public ResponseEntity<LeadScoreDTO> setManualScore(
            @PathVariable String responseId,
            @RequestBody java.util.Map<String, Integer> body,
            @RequestAttribute("user") CustomUserDetails user) {
        Integer score = body.get("score");
        LeadScoreDTO result = audienceService.setManualScore(responseId, score, user.getUserId(), user.getUsername());
        return ResponseEntity.ok(result);
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
     * Builds the profile on-demand if it doesn't exist yet (e.g. batch hasn't run).
     * GET /admin-core-service/v1/audience/user-lead-profile?userId=...&instituteId=...
     */
    @GetMapping("/user-lead-profile")
    public ResponseEntity<?> getUserLeadProfile(
            @RequestParam String userId,
            @RequestParam String instituteId) {
        // Try existing profile first
        var existing = userLeadProfileService.getProfileDTO(userId, instituteId);
        if (existing.isPresent()) {
            return ResponseEntity.ok(existing.get());
        }
        // Build on-demand — creates a profile if the user has any audience responses
        try {
            userLeadProfileService.buildOrUpdateProfile(userId, instituteId);
        } catch (Exception ignored) {
            // No audience data for this user — that's fine
        }
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
     * Update lead conversion status (LEAD, CONVERTED, LOST).
     * POST /admin-core-service/v1/audience/user-lead-profile/update-status?userId=...&instituteId=...&status=...
     */
    @PostMapping("/user-lead-profile/update-status")
    public ResponseEntity<UserLeadProfileDTO> updateLeadStatus(
            @RequestParam String userId,
            @RequestParam String instituteId,
            @RequestParam String status,
            @RequestAttribute("user") CustomUserDetails user) {
        String oldStatus = userLeadProfileService.getProfileDTO(userId, instituteId)
                .map(p -> p.getConversionStatus())
                .orElse(null);
        userLeadProfileService.updateConversionStatus(userId, instituteId, status);
        try {
            LeadJourneyActionType actionType = "CONVERTED".equals(status) ? LeadJourneyActionType.LEAD_CONVERTED
                    : "LOST".equals(status) ? LeadJourneyActionType.LEAD_LOST
                    : LeadJourneyActionType.STATUS_CHANGED;
            String title = "CONVERTED".equals(status) ? "Lead converted"
                    : "LOST".equals(status) ? "Lead marked as lost"
                    : "Status changed to " + status;
            Map<String, Object> meta = new java.util.LinkedHashMap<>();
            if (oldStatus != null) meta.put("old_status", oldStatus);
            meta.put("new_status", status);
            meta.put("changed_by", user.getUsername() != null ? user.getUsername() : "");
            timelineEventService.logJourneyEvent(
                    "USER_LEAD_PROFILE", userId,
                    actionType,
                    "ADMIN", user.getUserId(), user.getUsername(),
                    title, null,
                    meta,
                    userId);
        } catch (Exception e) {
            // best-effort
        }
        return ResponseEntity.ok(userLeadProfileService.getProfileDTO(userId, instituteId).orElse(null));
    }

    /**
     * Manually set lead tier (HOT, WARM, COLD) by overriding the score.
     * POST /admin-core-service/v1/audience/user-lead-profile/update-tier?userId=...&instituteId=...&tier=HOT
     */
    @PostMapping("/user-lead-profile/update-tier")
    public ResponseEntity<UserLeadProfileDTO> updateLeadTier(
            @RequestParam String userId,
            @RequestParam String instituteId,
            @RequestParam String tier,
            @RequestAttribute("user") CustomUserDetails user) {
        userLeadProfileService.updateLeadTier(userId, instituteId, tier);
        try {
            timelineEventService.logJourneyEvent(
                    "USER_LEAD_PROFILE", userId,
                    LeadJourneyActionType.STATUS_CHANGED,
                    "ADMIN", user.getUserId(), user.getUsername(),
                    "Lead tier set to " + tier, null,
                    Map.of("tier", tier, "changed_by", user.getUsername() != null ? user.getUsername() : ""),
                    userId);
        } catch (Exception e) {
            // best-effort
        }
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

    /**
     * Assign a counselor to a user's lead profile.
     * POST /admin-core-service/v1/audience/user-lead-profile/assign-counselor
     *   ?userId=...&instituteId=...&counselorId=...&counselorName=...
     */
    @PostMapping("/user-lead-profile/assign-counselor")
    public ResponseEntity<UserLeadProfileDTO> assignCounselor(
            @RequestParam String userId,
            @RequestParam String instituteId,
            @RequestParam String counselorId,
            @RequestParam(required = false) String counselorName,
            @RequestAttribute("user") CustomUserDetails user) {
        userLeadProfileService.assignCounselor(userId, instituteId, counselorId, counselorName);
        try {
            timelineEventService.logJourneyEvent(
                    "USER_LEAD_PROFILE", userId,
                    LeadJourneyActionType.COUNSELOR_ASSIGNED,
                    "ADMIN", user.getUserId(), user.getUsername(),
                    "Counselor assigned",
                    "Assigned to " + (counselorName != null ? counselorName : counselorId),
                    Map.of("counselor_id", counselorId,
                           "counselor_name", counselorName != null ? counselorName : "",
                           "assigned_by", user.getUsername() != null ? user.getUsername() : ""),
                    userId);
        } catch (Exception e) {
            // best-effort — don't fail the assignment if logging fails
        }
        try {
            // Bell notification to the counsellor — manual assignment should
            // light up the bell exactly like pool auto-assignment does.
            leadAssignmentNotifier.notifyAssigned(instituteId, counselorId, null, null);
        } catch (Exception e) {
            // best-effort — don't fail the assignment if notification fails
        }
        return ResponseEntity.ok(userLeadProfileService.getProfileDTO(userId, instituteId).orElse(null));
    }
}

