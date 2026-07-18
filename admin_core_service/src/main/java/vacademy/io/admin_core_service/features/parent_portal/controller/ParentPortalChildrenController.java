package vacademy.io.admin_core_service.features.parent_portal.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.parent_portal.dto.ChildOverviewDTO;
import vacademy.io.admin_core_service.features.parent_portal.dto.ParentChildSummaryDTO;
import vacademy.io.admin_core_service.features.parent_portal.dto.ParentPortalSettingsDTO;
import vacademy.io.admin_core_service.features.parent_portal.service.ParentPortalChildrenService;
import vacademy.io.admin_core_service.features.parent_portal.service.ParentPortalOverviewService;
import vacademy.io.admin_core_service.features.parent_portal.service.ParentPortalSettingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Parent-portal BFF — children listing + institute settings.
 *
 * <p><b>Design rule #0:</b> the guardian id is always {@code user.getUserId()}
 * (from the JWT) and the institute is the {@code clientId} header — never a
 * request parameter. There is deliberately no {@code parentUserId} anywhere on
 * this surface. Authorisation runs inside {@link ParentPortalChildrenService}
 * via the {@code GuardianAccessGuard}.
 *
 * <p>Base path is NOT in ApplicationSecurityConfig.ALLOWED_PATHS, so it falls
 * through to {@code anyRequest().authenticated()}.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/parent-portal/v1")
@RequiredArgsConstructor
public class ParentPortalChildrenController {

    private final ParentPortalChildrenService childrenService;
    private final ParentPortalSettingService settingService;
    private final ParentPortalOverviewService overviewService;

    /** The guardian's linked, enrolled children in the current institute (child picker). */
    @GetMapping("/children")
    public ResponseEntity<List<ParentChildSummaryDTO>> getChildren(
            @RequestHeader("clientId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(childrenService.listChildren(user, instituteId));
    }

    /** The child-home overview: at-a-glance counts + module availability. */
    @GetMapping("/children/{childUserId}/overview")
    public ResponseEntity<ChildOverviewDTO> getOverview(
            @PathVariable String childUserId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(overviewService.overview(user, childUserId));
    }

    /** Resolved parent-portal config for the current institute (module visibility, gates). */
    @GetMapping("/settings")
    public ResponseEntity<ParentPortalSettingsDTO> getSettings(
            @RequestHeader("clientId") String instituteId) {
        return ResponseEntity.ok(settingService.getSettings(instituteId));
    }
}
