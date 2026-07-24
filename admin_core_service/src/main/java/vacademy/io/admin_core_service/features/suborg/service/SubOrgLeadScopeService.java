package vacademy.io.admin_core_service.features.suborg.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Resolves the lead-visibility scope for a <b>sub-org admin</b>.
 *
 * <p>Why this exists as its own detector rather than a role check or an
 * institute setting: a sub-org admin is <i>also granted the parent institute's
 * {@code ADMIN} role</i> (see {@code SubOrgTeamService.ensureCallerCanAccessSubOrg}),
 * so by role they are indistinguishable from a true institute admin. The only
 * reliable fingerprint of a sub-org admin is the presence of ACTIVE
 * {@code SUB_ORG}-linked {@code FacultySubjectPackageSessionMapping} rows — the
 * exact same signal the sub-org team-management code uses. Because of that, the
 * "should this caller be scoped" decision cannot live in the role-keyed
 * audience-access setting; it has to be resolved from FSPSSM at request time.
 *
 * <p>A sub-org admin must see only the leads assigned to members of the
 * sub-org(s) they administer — never the parent institute's full lead pool.
 * This is a data-isolation requirement, not a configurable display preference,
 * so it is enforced by default with no setting toggle.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubOrgLeadScopeService {

    private static final List<String> ACTIVE = List.of("ACTIVE");

    private final FacultySubjectPackageSessionMappingRepository facultyMappingRepository;

    /**
     * The sub-orgs the caller currently administers (ACTIVE {@code SUB_ORG}
     * FSPSSM linkage). Empty for a true institute admin / any non-sub-org user.
     */
    public List<String> callerSubOrgIds(String callerUserId) {
        if (callerUserId == null || callerUserId.isBlank()) return Collections.emptyList();
        try {
            return facultyMappingRepository
                    .findDistinctSubOrgIdsByUserAndLinkage(callerUserId, ACTIVE);
        } catch (Exception e) {
            // Fail closed to "not a sub-org admin" — a DB hiccup must not silently
            // widen a sub-org admin's view to the whole parent institute. The
            // caller then falls through to the normal (admin/counsellor) rules.
            log.warn("callerSubOrgIds({}) failed, treating as non-sub-org: {}",
                    callerUserId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /** True when the caller administers at least one sub-org. */
    public boolean isSubOrgAdmin(String callerUserId) {
        return !callerSubOrgIds(callerUserId).isEmpty();
    }

    /**
     * Distinct member user_ids across every sub-org the caller administers —
     * i.e. the counsellors (and the sub-org admin themselves) whose assigned
     * leads a sub-org admin is allowed to see. Returns an empty list when the
     * caller is not a sub-org admin, so callers can treat "empty" as "no
     * sub-org scoping applies".
     */
    public List<String> subOrgScopedCounsellorUserIds(String callerUserId) {
        List<String> subOrgIds = callerSubOrgIds(callerUserId);
        if (subOrgIds.isEmpty()) return Collections.emptyList();
        LinkedHashSet<String> members = new LinkedHashSet<>();
        for (String subOrgId : subOrgIds) {
            if (subOrgId == null || subOrgId.isBlank()) continue;
            try {
                members.addAll(facultyMappingRepository
                        .findDistinctUserIdsBySubOrgIdAndLinkage(subOrgId, ACTIVE));
            } catch (Exception e) {
                log.warn("subOrgScopedCounsellorUserIds: members lookup for sub-org {} failed: {}",
                        subOrgId, e.getMessage());
            }
        }
        return new ArrayList<>(members);
    }
}
