package vacademy.io.admin_core_service.features.engagement.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Access guard for the Engagement Engine surface. Membership alone is not enough here:
 * the inbox holds AI-drafted message bodies, rationales, and other subjects' contact PII,
 * so a same-institute LEARNER passing the membership check must NOT be able to read it.
 * The founder locked this to institute admins (design D16), so we require the ADMIN role
 * (root users bypass, mirroring InstituteAccessValidator / SuperAdminAuthUtil).
 */
@Component
@RequiredArgsConstructor
public class EngagementAccessGuard {

    private final InstituteAccessValidator instituteAccessValidator;

    public void requireAdmin(CustomUserDetails user, String instituteId) {
        instituteAccessValidator.validateUserAccess(user, instituteId); // membership + root bypass
        if (user != null && user.isRootUser()) return;

        Set<String> roles = user == null || user.getAuthorities() == null ? Set.of()
                : user.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .filter(Objects::nonNull)
                        .map(String::toUpperCase)
                        .collect(Collectors.toSet());
        if (!roles.contains("ADMIN")) {
            throw new VacademyException("Engagement Engines require an institute ADMIN role");
        }
    }
}
