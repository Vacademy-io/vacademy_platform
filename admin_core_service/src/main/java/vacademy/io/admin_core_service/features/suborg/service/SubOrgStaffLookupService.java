package vacademy.io.admin_core_service.features.suborg.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Answers "which staff of a sub-org should hear about something a sub-org learner did".
 *
 * <p>Needed because a sub-org is <b>not</b> its own tenant: its learners, courses and batches all
 * live under the PARENT institute id, so any institute-scoped fan-out (role lookups in
 * auth-service, batch-teacher cascades) resolves to the parent's staff and skips the sub-org
 * entirely. The sub-org's own people have to be resolved from the sub-org linkage explicitly.
 *
 * <p>"Staff" is the union of the two ways a person can be attached to a sub-org — they are written
 * by different flows and neither is a superset of the other:
 * <ul>
 *   <li><b>Team members</b> — {@code faculty_subject_package_session_mapping} rows with
 *       {@code linkage_type='SUB_ORG'} + {@code suborg_id}. Written by
 *       {@code SubOrgTeamService.addMember} (Manage Sub-Org Teams). Carries the sub-org admin too
 *       when they were added that way, and every custom-role team member.</li>
 *   <li><b>Sub-org admins</b> — {@code student_session_institute_group_mapping} rows stamped with
 *       {@code sub_org_id} whose {@code comma_separated_org_roles} contain ADMIN/ROOT_ADMIN.
 *       Written by the sub-org registration/enrollment path, which does <i>not</i> create FSPSSM
 *       rows, so these accounts are invisible to the first arm.</li>
 * </ul>
 *
 * <p>Every lookup is best-effort: a failure returns empty rather than propagating, so a caller
 * using this as an additive recipient list can never be broken by it.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubOrgStaffLookupService {

    private static final List<String> ACTIVE = List.of("ACTIVE");

    private final FacultySubjectPackageSessionMappingRepository facultyMappingRepository;
    private final StudentSessionInstituteGroupMappingRepository studentMappingRepository;

    /** Who inside the sub-org should be notified. Mirrors the admin-facing setting values. */
    public enum Audience {
        /** Only the sub-org's own admins (ADMIN / ROOT_ADMIN org roles). */
        ADMINS_ONLY,
        /** Admins plus every active team member of the sub-org. */
        ALL_TEAM
    }

    /**
     * The sub-org(s) a learner belongs to, in the context of a specific event.
     *
     * <p><b>When the event carries a batch</b> (a slide doubt, an assessment, …), that batch is the
     * ONLY correct scope. A learner is a sub-org member <i>of a particular batch</i>: the same person
     * can be a sub-org learner in batch A and a plain parent-institute learner in batch B. Resolving
     * through anything but the event's own batch would attribute it to a sub-org that doesn't own it
     * — and, in the exclusive-routing mode, would wrongly silence the real parent-batch staff. The
     * batch-scoped query already captures BOTH the stamped {@code sub_org_id} and the invite-based
     * (self-enrolled) path for that batch, so there is deliberately no institute-wide fallback here:
     * an empty result means "not a sub-org learner for this batch", which is the right answer.
     *
     * <p><b>Batch-less events</b> (general queries) have no better signal, so they use the learner's
     * institute-wide sub-org membership.
     */
    public List<String> resolveLearnerSubOrgIds(String userId, String instituteId, String packageSessionId) {
        if (!StringUtils.hasText(userId)) return Collections.emptyList();
        if (StringUtils.hasText(packageSessionId)) {
            try {
                return clean(studentMappingRepository
                        .findActiveSubOrgIdsForUserInPackageSession(userId, packageSessionId));
            } catch (Exception e) {
                log.warn("Sub-org lookup by package session failed (user={}, ps={}): {}",
                        userId, packageSessionId, e.getMessage());
                return Collections.emptyList();
            }
        }
        if (!StringUtils.hasText(instituteId)) return Collections.emptyList();
        try {
            return clean(studentMappingRepository
                    .findActiveSubOrgIdsForUserInInstitute(userId, instituteId));
        } catch (Exception e) {
            log.warn("Sub-org lookup by institute failed (user={}, institute={}): {}",
                    userId, instituteId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Distinct staff user ids across the given sub-orgs for the requested {@code audience}.
     * Order is stable (admins first, then team members) but carries no other meaning.
     */
    public List<String> resolveStaffUserIds(List<String> subOrgIds, Audience audience) {
        if (subOrgIds == null || subOrgIds.isEmpty()) return Collections.emptyList();
        LinkedHashSet<String> staff = new LinkedHashSet<>();
        for (String subOrgId : subOrgIds) {
            if (!StringUtils.hasText(subOrgId)) continue;
            try {
                staff.addAll(clean(studentMappingRepository.findActiveAdminUserIdsBySubOrg(subOrgId)));
            } catch (Exception e) {
                log.warn("Sub-org admin lookup failed (subOrg={}): {}", subOrgId, e.getMessage());
            }
            if (audience == Audience.ALL_TEAM) {
                try {
                    staff.addAll(clean(facultyMappingRepository
                            .findDistinctUserIdsBySubOrgIdAndLinkage(subOrgId, ACTIVE)));
                } catch (Exception e) {
                    log.warn("Sub-org team lookup failed (subOrg={}): {}", subOrgId, e.getMessage());
                }
            }
        }
        return new ArrayList<>(staff);
    }

    private List<String> clean(List<String> ids) {
        if (ids == null) return Collections.emptyList();
        return ids.stream().filter(StringUtils::hasText).distinct().toList();
    }
}
