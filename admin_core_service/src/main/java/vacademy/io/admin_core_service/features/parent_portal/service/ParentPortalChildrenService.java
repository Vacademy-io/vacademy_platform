package vacademy.io.admin_core_service.features.parent_portal.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.core.security.GuardianAccessGuard;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.learner.dto.StudentInstituteInfoDTO;
import vacademy.io.admin_core_service.features.learner.manager.LearnerInstituteManager;
import vacademy.io.admin_core_service.features.parent_portal.dto.ParentChildSummaryDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.dto.PackageSessionDTO;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The {@code /children} listing — the child-picker backend.
 *
 * <p>Enumerates the caller's linked children (authoritative, via the guard),
 * enriches each with the institute + batch context that the raw auth_service
 * {@code UserDTO} lacks, and drops any child not enrolled in the clientId
 * institute (empty batches = not here — this is how the listing stays
 * institute-scoped even though the guardian link is institute-independent).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ParentPortalChildrenService {

    private final GuardianAccessGuard guard;
    private final LearnerInstituteManager learnerInstituteManager;
    private final ParentPortalSettingService settingService;
    private final StudentSessionInstituteGroupMappingRepository ssigmRepository;

    public List<ParentChildSummaryDTO> listChildren(CustomUserDetails caller, String instituteId) {
        settingService.requireEnabled(instituteId);
        List<UserDTO> children = guard.listGuardianChildren(caller);

        List<ParentChildSummaryDTO> result = new ArrayList<>();
        for (UserDTO child : children) {
            if (child == null || !StringUtils.hasText(child.getId())) {
                continue;
            }
            // Inclusion gate: the CHILD's own non-terminal enrolment in THIS institute —
            // NOT the institute's batch pool (getInstituteDetails.batchesForSessions is
            // institute-wide and would over-list). Same source the guard uses, so the
            // picker and the per-child endpoints agree.
            List<String> childPackageSessionIds =
                    ssigmRepository.findEnrolledPackageSessionIds(child.getId(), instituteId);
            if (childPackageSessionIds.isEmpty()) {
                continue; // not enrolled here — don't surface
            }
            try {
                StudentInstituteInfoDTO info =
                        learnerInstituteManager.getInstituteDetails(instituteId, child.getId(), true);
                String instituteName = info != null ? info.getInstituteName() : null;

                // Real batch labels for the child's OWN sessions: intersect the institute's
                // batch pool with the child's package session ids.
                Set<String> childPs = new HashSet<>(childPackageSessionIds);
                List<PackageSessionDTO> pool = (info != null && info.getBatchesForSessions() != null)
                        ? info.getBatchesForSessions()
                        : List.of();
                List<ParentChildSummaryDTO.EnrollmentSummary> enrollments = pool.stream()
                        .filter(ps -> ps.getId() != null && childPs.contains(ps.getId()))
                        .map(this::toEnrollment)
                        .toList();
                // Fallback: a child session not present in the institute's active pool still
                // counts as an enrolment — emit id-only so the child isn't dropped.
                if (enrollments.isEmpty()) {
                    enrollments = childPackageSessionIds.stream()
                            .map(id -> ParentChildSummaryDTO.EnrollmentSummary.builder()
                                    .packageSessionId(id).batchName("").build())
                            .toList();
                }

                result.add(ParentChildSummaryDTO.builder()
                        .childUserId(child.getId())
                        .fullName(child.getFullName())
                        .email(child.getEmail())
                        .mobileNumber(child.getMobileNumber())
                        .profilePicFileId(child.getProfilePicFileId())
                        .instituteId(instituteId)
                        .instituteName(instituteName)
                        .enrollments(enrollments)
                        .build());
            } catch (Exception e) {
                // one child's enrichment failure must not drop the whole list
                log.warn("Could not enrich child {} for institute {}: {}",
                        child.getId(), instituteId, e.getMessage());
            }
        }
        return result;
    }

    private ParentChildSummaryDTO.EnrollmentSummary toEnrollment(PackageSessionDTO ps) {
        return ParentChildSummaryDTO.EnrollmentSummary.builder()
                .packageSessionId(ps.getId())
                .batchName(batchLabel(ps))
                .status(ps.getStatus())
                .build();
    }

    /** "Level Package (Session)" — the same human label idiom IdentityCollector uses; never the raw UUID. */
    private String batchLabel(PackageSessionDTO ps) {
        if (ps == null) {
            return "";
        }
        String level = ps.getLevel() != null ? ps.getLevel().getLevelName() : null;
        String pkg = ps.getPackageDTO() != null ? ps.getPackageDTO().getPackageName() : null;
        String session = ps.getSession() != null ? ps.getSession().getSessionName() : null;

        StringBuilder sb = new StringBuilder();
        if (StringUtils.hasText(level)) sb.append(level);
        if (StringUtils.hasText(pkg)) sb.append(sb.length() > 0 ? " " : "").append(pkg);
        if (StringUtils.hasText(session)) sb.append(" (").append(session).append(")");
        if (sb.length() == 0) {
            return StringUtils.hasText(ps.getName()) ? ps.getName() : "";
        }
        return sb.toString();
    }
}
