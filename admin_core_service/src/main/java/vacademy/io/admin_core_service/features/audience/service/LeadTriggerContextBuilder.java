package vacademy.io.admin_core_service.features.audience.service;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPoolAudience;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolAudienceRepository;

import java.util.HashMap;
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
public class LeadTriggerContextBuilder {

    // Canonical stage tokens persisted on audience_response.tat_reminder_stage.
    // The scheduler writes these; the leads-table badge reads them. Distinct from the
    // per-window "stage" labels in LEAD_SETTING (those only feed the dedup key).
    public static final String STAGE_TAT_BEFORE = "TAT_BEFORE";
    public static final String STAGE_TAT_OVERDUE = "TAT_OVERDUE";
    public static final String STAGE_FOLLOW_UP_DUE = "FOLLOW_UP_DUE";
    public static final String STAGE_FOLLOW_UP_OVERDUE = "FOLLOW_UP_OVERDUE";

    private final CounselorPoolAudienceRepository poolAudienceRepository;

    public LeadTriggerContextBuilder(CounselorPoolAudienceRepository poolAudienceRepository) {
        this.poolAudienceRepository = poolAudienceRepository;
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
            put(ctx, "parentName", ar.getParentName());
            put(ctx, "parentEmail", ar.getParentEmail());
            put(ctx, "parentMobile", ar.getParentMobile());
        }
        put(ctx, "campaignName", campaignName);
        put(ctx, "counselorId", counselorId);
        put(ctx, "counselorName", counselorName);
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
        return ctx;
    }

    public void put(Map<String, Object> ctx, String key, Object value) {
        if (value != null) ctx.put(key, value);
    }
}
