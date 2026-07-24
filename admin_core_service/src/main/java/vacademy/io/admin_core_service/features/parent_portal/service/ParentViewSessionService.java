package vacademy.io.admin_core_service.features.parent_portal.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.core.security.GuardedChild;
import vacademy.io.admin_core_service.core.security.GuardianAccessGuard;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.parent_portal.dto.ParentViewSessionDTO;
import vacademy.io.common.auth.dto.learner.UserWithJwtDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

/**
 * Mints a "view as my child" session. The guard proves the parent&rarr;child link;
 * the institute must have {@code allowViewAsChild} on; then we reuse the existing
 * internal token mint ({@code generate-token-for-learner}) to get a token that IS
 * the child, so every learner API works unchanged. The parent's own token is never
 * overwritten — the client stores this under a separate key and enforces read-only.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ParentViewSessionService {

    private final GuardianAccessGuard guard;
    private final ParentPortalSettingService settingService;
    private final AuthService authService;

    public ParentViewSessionDTO createViewSession(CustomUserDetails caller, String childUserId) {
        GuardedChild child = guard.requireLinkedChild(caller, childUserId);
        settingService.requireViewAsChild(child.instituteId());

        UserWithJwtDTO minted = authService.generateJwtTokensWithUser(child.childUserId(), child.instituteId());
        if (minted == null || minted.getAccessToken() == null) {
            throw new VacademyException("Could not start the child view session");
        }

        // Audit: who really did it.
        log.info("Guardian view-as-child: parent={} viewing child={} institute={}",
                caller.getUserId(), child.childUserId(), child.instituteId());

        return ParentViewSessionDTO.builder()
                .childUserId(child.childUserId())
                .childName(child.fullName())
                .accessToken(minted.getAccessToken())
                .refreshToken(minted.getRefreshToken())
                .build();
    }
}
