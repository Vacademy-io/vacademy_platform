package vacademy.io.community_service.feature.dashboardwidget.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.dashboardwidget.dto.CreateInteractionRequest;
import vacademy.io.community_service.feature.dashboardwidget.dto.DashboardWidgetDto;
import vacademy.io.community_service.feature.dashboardwidget.dto.WidgetInteractionDto;
import vacademy.io.community_service.feature.dashboardwidget.service.DashboardWidgetService;
import vacademy.io.community_service.feature.dashboardwidget.service.WidgetInteractionService;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Institute-facing dashboard widgets (admin dashboard).
 *
 * <p><b>Authorization.</b> Like {@code SupportAdminController}, every endpoint requires the caller
 * to hold the {@code ADMIN} role in the institute named by the {@code clientId} header. The JWT
 * filter only populates {@link CustomUserDetails#getAuthorities()} for that institute, so the role
 * check doubles as the tenant-isolation guard. Actor identity is always taken from the principal.
 */
@RestController
@RequestMapping("/community-service/dashboard-widget/v1")
public class DashboardWidgetController {

    private static final String ADMIN_ROLE = "ADMIN";

    @Autowired
    private DashboardWidgetService widgetService;
    @Autowired
    private WidgetInteractionService interactionService;

    /** Published widgets visible to this admin (their institute + lead-tag broadcasts, role-filtered). */
    @GetMapping("/me")
    public ResponseEntity<List<DashboardWidgetDto>> myWidgets(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestHeader(value = "clientId", required = false) String clientId,
            @RequestParam(value = "instituteId", required = false) String instituteIdParam) {
        requireAdmin(user);
        String instituteId = resolveInstituteId(clientId, instituteIdParam);
        return ResponseEntity.ok(widgetService.resolveForInstitute(instituteId, callerRoles(user)));
    }

    @PostMapping("/{id}/comment")
    public ResponseEntity<WidgetInteractionDto> comment(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestHeader(value = "clientId", required = false) String clientId,
            @RequestParam(value = "instituteId", required = false) String instituteIdParam,
            @PathVariable String id,
            @RequestBody CreateInteractionRequest request) {
        requireAdmin(user);
        String instituteId = resolveInstituteId(clientId, instituteIdParam);
        String message = request != null ? request.getMessage() : null;
        String milestoneId = request != null ? request.getMilestoneId() : null;
        return ResponseEntity.status(HttpStatus.CREATED).body(interactionService.addComment(
                id, instituteId, user.getUserId(), user.getFullName(), message, milestoneId));
    }

    @PostMapping("/{id}/milestones/{milestoneId}/confirm")
    public ResponseEntity<WidgetInteractionDto> confirmMilestone(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestHeader(value = "clientId", required = false) String clientId,
            @RequestParam(value = "instituteId", required = false) String instituteIdParam,
            @PathVariable String id,
            @PathVariable String milestoneId,
            @RequestBody(required = false) CreateInteractionRequest request) {
        requireAdmin(user);
        String instituteId = resolveInstituteId(clientId, instituteIdParam);
        String message = request != null ? request.getMessage() : null;
        return ResponseEntity.status(HttpStatus.CREATED).body(interactionService.confirmMilestone(
                id, milestoneId, instituteId, user.getUserId(), user.getFullName(), message));
    }

    // ---------------------------------------------------------------------

    private List<String> callerRoles(CustomUserDetails user) {
        if (user == null || user.getAuthorities() == null) {
            return List.of();
        }
        return user.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(StringUtils::hasText)
                .collect(Collectors.toList());
    }

    private void requireAdmin(CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        boolean isAdmin = user.getAuthorities() != null && user.getAuthorities().stream()
                .anyMatch(a -> ADMIN_ROLE.equalsIgnoreCase(a.getAuthority()));
        if (!isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin access required for this institute");
        }
    }

    private String resolveInstituteId(String clientId, String instituteIdParam) {
        if (StringUtils.hasText(clientId)) {
            return clientId.trim();
        }
        if (StringUtils.hasText(instituteIdParam)) {
            return instituteIdParam.trim();
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "institute id is required (clientId header or instituteId param)");
    }
}
