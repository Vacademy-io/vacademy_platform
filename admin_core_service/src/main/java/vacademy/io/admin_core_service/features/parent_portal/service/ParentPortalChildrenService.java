package vacademy.io.admin_core_service.features.parent_portal.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.core.security.GuardianAccessGuard;
import vacademy.io.admin_core_service.features.learner.dto.StudentInstituteInfoDTO;
import vacademy.io.admin_core_service.features.learner.manager.LearnerInstituteManager;
import vacademy.io.admin_core_service.features.parent_portal.dto.ParentChildSummaryDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.dto.PackageSessionDTO;

import java.util.ArrayList;
import java.util.List;

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

    public List<ParentChildSummaryDTO> listChildren(CustomUserDetails caller, String instituteId) {
        settingService.requireEnabled(instituteId);
        List<UserDTO> children = guard.listGuardianChildren(caller);

        List<ParentChildSummaryDTO> result = new ArrayList<>();
        for (UserDTO child : children) {
            if (child == null || !StringUtils.hasText(child.getId())) {
                continue;
            }
            try {
                StudentInstituteInfoDTO info =
                        learnerInstituteManager.getInstituteDetails(instituteId, child.getId(), true);
                List<PackageSessionDTO> batches = info == null ? null : info.getBatchesForSessions();
                if (batches == null || batches.isEmpty()) {
                    continue; // not enrolled in this institute — don't surface
                }
                result.add(ParentChildSummaryDTO.builder()
                        .childUserId(child.getId())
                        .fullName(child.getFullName())
                        .email(child.getEmail())
                        .mobileNumber(child.getMobileNumber())
                        .profilePicFileId(child.getProfilePicFileId())
                        .instituteId(instituteId)
                        .instituteName(info.getInstituteName())
                        .enrollments(batches.stream().map(this::toEnrollment).toList())
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
