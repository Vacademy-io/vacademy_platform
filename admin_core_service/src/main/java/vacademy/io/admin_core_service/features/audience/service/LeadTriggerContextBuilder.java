package vacademy.io.admin_core_service.features.audience.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPoolAudience;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolAudienceRepository;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Assembles the standard context map emitted with lead workflow triggers
 * (LEAD_ASSIGNED_TO_COUNSELOR, LEAD_TAT_REMINDER_BEFORE, LEAD_TAT_OVERDUE,
 * FOLLOW_UP_DUE, FOLLOW_UP_OVERDUE, LEAD_STATUS_CHANGED).
 *
 * <p>The backend only emits triggers — the workflow engine reads these keys via SpEL
 * (e.g. {@code #ctx['counselorId']}) to decide channel/template/recipients. Null values
 * are omitted so templates can null-check cleanly.</p>
 */
@Component
@Slf4j
public class LeadTriggerContextBuilder {

    // Canonical stage tokens persisted on audience_response.tat_reminder_stage.
    // The scheduler writes these; the leads-table badge reads them. Distinct from the
    // per-window "stage" labels in LEAD_SETTING (those only feed the dedup key).
    public static final String STAGE_TAT_BEFORE = "TAT_BEFORE";
    public static final String STAGE_TAT_OVERDUE = "TAT_OVERDUE";
    public static final String STAGE_FOLLOW_UP_DUE = "FOLLOW_UP_DUE";
    public static final String STAGE_FOLLOW_UP_OVERDUE = "FOLLOW_UP_OVERDUE";

    private final CounselorPoolAudienceRepository poolAudienceRepository;
    private final AuthService authService;
    private final AudienceRepository audienceRepository;

    public LeadTriggerContextBuilder(CounselorPoolAudienceRepository poolAudienceRepository,
                                     AuthService authService,
                                     AudienceRepository audienceRepository) {
        this.poolAudienceRepository = poolAudienceRepository;
        this.authService = authService;
        this.audienceRepository = audienceRepository;
    }

    /**
     * Resolve the counselor pool that owns an audience, so pool-scoped workflow triggers
     * can fire alongside institute-level ones. Each audience belongs to at most one pool
     * (UNIQUE constraint), so this is a single lookup. Returns null when the audience isn't
     * pooled. Best-effort — never throws into the emit path.
     */
    public String resolvePoolId(String audienceId) {
        if (audienceId == null || audienceId.isBlank()) return null;
        try {
            return poolAudienceRepository.findByAudienceId(audienceId)
                    .map(CounselorPoolAudience::getPoolId)
                    .orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Look up the counselor's email/mobile from auth-service and add them to the ctx so a
     * communication workflow can default to "send to the assigned counsellor". Without this
     * the ctx only carries counselorId, which SEND_EMAIL / SEND_WHATSAPP can't resolve into
     * an address. Best-effort; never throws into the emit path.
     */
    public void enrichCounselorContact(Map<String, Object> ctx, String counselorId) {
        if (counselorId == null || counselorId.isBlank()) return;
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(counselorId));
            if (users == null || users.isEmpty()) return;
            UserDTO u = users.get(0);
            put(ctx, "counselorEmail", u.getEmail());
            put(ctx, "counselorMobile", u.getMobileNumber());
            // Only set counselorName if the caller didn't already provide one (don't overwrite
            // a snapshot the emit site chose to use).
            if (!ctx.containsKey("counselorName")) {
                put(ctx, "counselorName", u.getFullName());
            }
        } catch (Exception e) {
            log.warn("[LeadTrigger] Failed to enrich counselor contact for {}: {}",
                    counselorId, e.getMessage());
        }
    }

    /** Context anchored on a specific lead row (audience_response). */
    public Map<String, Object> forLead(AudienceResponse ar, String instituteId, String campaignName,
                                       String counselorId, String counselorName) {
        Map<String, Object> ctx = new HashMap<>();
        put(ctx, "instituteId", instituteId);
        if (ar != null) {
            put(ctx, "leadId", ar.getId());
            put(ctx, "userId", ar.getUserId());
            put(ctx, "studentUserId", ar.getStudentUserId());
            put(ctx, "enquiryId", ar.getEnquiryId());
            put(ctx, "audienceId", ar.getAudienceId());
            put(ctx, "poolId", resolvePoolId(ar.getAudienceId()));
            // `parent_*` are the audience_response column names (historical K-12 naming where
            // the parent submitted the form). For our lead list the lead IS the user, so we
            // also expose the same values under cleaner lead-* keys. Both work in templates;
            // new sample templates use lead-* for clarity.
            put(ctx, "parentName", ar.getParentName());
            put(ctx, "parentEmail", ar.getParentEmail());
            put(ctx, "parentMobile", ar.getParentMobile());
            put(ctx, "leadName", ar.getParentName());
            put(ctx, "leadEmail", ar.getParentEmail());
            put(ctx, "leadMobile", ar.getParentMobile());
            // If the caller didn't pass a campaignName, look it up from the audience so
            // {{campaignName}} resolves for every forLead path (not just the SLA scheduler
            // which already passes it from LeadSlaCandidate).
            if ((campaignName == null || campaignName.isBlank()) && ar.getAudienceId() != null) {
                try {
                    campaignName = audienceRepository.findById(ar.getAudienceId())
                            .map(Audience::getCampaignName)
                            .orElse(null);
                } catch (Exception e) {
                    log.debug("[LeadTrigger] campaignName lookup failed for audience {}: {}",
                            ar.getAudienceId(), e.getMessage());
                }
            }
        }
        put(ctx, "campaignName", campaignName);
        put(ctx, "counselorId", counselorId);
        put(ctx, "counselorName", counselorName);
        enrichCounselorContact(ctx, counselorId);
        return ctx;
    }

    /** Context anchored on a user-level lead (e.g. profile-level assignment / status change). */
    public Map<String, Object> forUser(String instituteId, String userId,
                                       String counselorId, String counselorName) {
        Map<String, Object> ctx = new HashMap<>();
        put(ctx, "instituteId", instituteId);
        put(ctx, "userId", userId);
        put(ctx, "leadId", userId);
        put(ctx, "counselorId", counselorId);
        put(ctx, "counselorName", counselorName);
        enrichCounselorContact(ctx, counselorId);
        return ctx;
    }

    public void put(Map<String, Object> ctx, String key, Object value) {
        if (value != null) ctx.put(key, value);
    }
}
