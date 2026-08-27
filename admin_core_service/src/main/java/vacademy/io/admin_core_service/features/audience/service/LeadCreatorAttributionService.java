package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.audience.dto.BulkSubmitLeadRequestDTO;
import vacademy.io.admin_core_service.features.audience.dto.SubmitLeadRequestDTO;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.service.AudienceRoleAccessService.EffectiveAccess;
import vacademy.io.admin_core_service.features.audience.service.AudienceRoleAccessService.Mode;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Stamps the creator as the lead's counsellor when the institute's audience
 * access setting asks for it.
 *
 * <p>Companion to the AUDIENCE_LIST {@code assigned_only} option: that option
 * narrows a role's lead lists to the leads they own, so without this a
 * counsellor who adds a lead by hand would watch it vanish the moment it saved
 * — created into a list they can see, but owned by nobody, and the
 * "only my assigned leads" filter drops unassigned rows. Assigning the creator
 * closes that hole and matches how the admin reads the setting: "leads I add
 * are mine".
 *
 * <p>Applies only to authenticated, admin-panel lead creation — the single
 * add-lead form and the CSV bulk import
 * ({@code POST /admin-core-service/v1/audience/lead/submit} and
 * {@code .../lead/bulk-submit}). Public intake — website forms, the catalogue
 * form, Meta/Google webhooks — has no creator to attribute and is untouched.
 *
 * <p>Never overrides an explicit counsellor on the request: a chosen owner is
 * a stronger signal than the default. And because it reads
 * {@link EffectiveAccess#isAssignedOnly()}, it inherits that flag's pool gate —
 * an institute running a counsellor pool keeps the pool as the sole owner of
 * lead routing.
 */
@Service
@RequiredArgsConstructor
public class LeadCreatorAttributionService {

    private static final Logger logger = LoggerFactory.getLogger(LeadCreatorAttributionService.class);

    private final AudienceRoleAccessService audienceRoleAccessService;
    private final AudienceRepository audienceRepository;

    /**
     * Mutates {@code requestDTO} in place, setting {@code counsellorId} to the
     * caller when the rule applies. No-op in every other case — a blank
     * counsellor still means "let the normal intake pipeline decide".
     *
     * <p>Deliberately swallows failures: attribution is a convenience on top of
     * lead intake and must never be the reason a lead fails to save.
     */
    public void applyCreatorAsCounsellor(SubmitLeadRequestDTO requestDTO, CustomUserDetails user) {
        if (requestDTO == null || !StringUtils.hasText(requestDTO.getAudienceId())) {
            return;
        }
        if (!creatorAssignmentApplies(requestDTO.getAudienceId(), user)) {
            return;
        }
        stampCreator(requestDTO, user);
    }

    /**
     * Same rule for a CSV / bulk import: rows that carry no owner column fall to
     * the person running the import. Without it a scoped counsellor could import
     * hundreds of leads into a list they can see and watch every one of them
     * disappear.
     *
     * <p>The access check runs once for the whole request, off the root
     * {@code audience_id} (falling back to the first row that names one) — the
     * bulk endpoint imports into a single campaign, so one institute.
     */
    public void applyCreatorAsCounsellor(BulkSubmitLeadRequestDTO request, CustomUserDetails user) {
        if (request == null || request.getRows() == null || request.getRows().isEmpty()) {
            return;
        }
        String audienceId = StringUtils.hasText(request.getAudienceId())
                ? request.getAudienceId()
                : request.getRows().stream()
                        .filter(r -> r != null && StringUtils.hasText(r.getAudienceId()))
                        .map(SubmitLeadRequestDTO::getAudienceId)
                        .findFirst()
                        .orElse(null);
        if (!StringUtils.hasText(audienceId) || !creatorAssignmentApplies(audienceId, user)) {
            return;
        }
        for (SubmitLeadRequestDTO row : request.getRows()) {
            if (row != null) {
                stampCreator(row, user);
            }
        }
    }

    /** No-op when the row already names an owner — an explicit choice outranks the default. */
    private void stampCreator(SubmitLeadRequestDTO row, CustomUserDetails user) {
        if (StringUtils.hasText(row.getCounsellorId())) {
            return;
        }
        row.setCounsellorId(user.getUserId());
    }

    /**
     * Does the institute behind this audience have the caller's role configured
     * as AUDIENCE_LIST + assigned-only? Reading
     * {@link EffectiveAccess#isAssignedOnly()} inherits that flag's counsellor-pool
     * gate for free.
     */
    private boolean creatorAssignmentApplies(String audienceId, CustomUserDetails user) {
        if (user == null || !StringUtils.hasText(user.getUserId())) {
            return false;
        }
        try {
            String instituteId = audienceRepository.findById(audienceId)
                    .map(Audience::getInstituteId)
                    .orElse(null);
            if (!StringUtils.hasText(instituteId)) {
                return false;
            }
            EffectiveAccess access = audienceRoleAccessService.resolveForCaller(user, instituteId);
            boolean applies = access.getMode() == Mode.AUDIENCE_LIST && access.isAssignedOnly();
            if (applies) {
                logger.info("[leadCreatorAttribution] creator {} will own new leads on audience {}",
                        user.getUserId(), audienceId);
            }
            return applies;
        } catch (Exception e) {
            logger.warn("[leadCreatorAttribution] skipped for audience {}: {}", audienceId, e.getMessage());
            return false;
        }
    }
}
