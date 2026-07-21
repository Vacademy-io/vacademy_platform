package vacademy.io.admin_core_service.features.parent_portal.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.parent_portal.dto.ParentViewSessionDTO;
import vacademy.io.admin_core_service.features.parent_portal.service.ParentViewSessionService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * "View as my child" — mints a short child-scoped session after the guard +
 * institute gate. The caller (parent) is always the JWT user; the child is a path
 * param the guard verifies is linked.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/parent-portal/v1/children/{childUserId}")
@RequiredArgsConstructor
public class ParentViewSessionController {

    private final ParentViewSessionService viewSessionService;

    @PostMapping("/view-session")
    public ResponseEntity<ParentViewSessionDTO> viewSession(
            @PathVariable String childUserId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(viewSessionService.createViewSession(user, childUserId));
    }
}
