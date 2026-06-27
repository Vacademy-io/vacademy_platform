package vacademy.io.community_service.feature.dashboardwidget.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;
import vacademy.io.community_service.feature.dashboardwidget.dto.DashboardWidgetDto;
import vacademy.io.community_service.feature.dashboardwidget.dto.OnboardingMilestoneTemplateDto;
import vacademy.io.community_service.feature.dashboardwidget.dto.UpsertWidgetRequest;
import vacademy.io.community_service.feature.dashboardwidget.dto.WidgetInteractionDto;
import vacademy.io.community_service.feature.dashboardwidget.service.DashboardWidgetService;
import vacademy.io.community_service.feature.dashboardwidget.service.OnboardingTemplateProvider;
import vacademy.io.community_service.feature.dashboardwidget.service.WidgetInteractionService;

import java.util.List;

/**
 * Super-admin authoring of per-institute dashboard widgets (health-check portal). Every method
 * requires a root user. Served under the {@code /super-admin/v1} prefix the health-check dashboard
 * already targets.
 */
@RestController
@RequestMapping("/community-service/super-admin/v1/dashboard-widgets")
public class DashboardWidgetSuperAdminController {

    @Autowired
    private DashboardWidgetService widgetService;
    @Autowired
    private WidgetInteractionService interactionService;
    @Autowired
    private OnboardingTemplateProvider templateProvider;

    /** Widgets for a target — pass exactly one of instituteId or leadTag. */
    @GetMapping
    public ResponseEntity<List<DashboardWidgetDto>> list(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(value = "instituteId", required = false) String instituteId,
            @RequestParam(value = "leadTag", required = false) String leadTag) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        if (StringUtils.hasText(instituteId)) {
            return ResponseEntity.ok(widgetService.listForInstitute(instituteId.trim()));
        }
        if (StringUtils.hasText(leadTag)) {
            return ResponseEntity.ok(widgetService.listForLeadTag(leadTag));
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "instituteId or leadTag is required");
    }

    @PostMapping
    public ResponseEntity<DashboardWidgetDto> create(@RequestAttribute("user") CustomUserDetails user,
                                                     @RequestBody UpsertWidgetRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(widgetService.create(request, user.getUserId()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DashboardWidgetDto> update(@RequestAttribute("user") CustomUserDetails user,
                                                     @PathVariable String id,
                                                     @RequestBody UpsertWidgetRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(widgetService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@RequestAttribute("user") CustomUserDetails user,
                                       @PathVariable String id) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        widgetService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Institute-side comments / milestone confirmations on a widget. */
    @GetMapping("/{id}/interactions")
    public ResponseEntity<List<WidgetInteractionDto>> interactions(@RequestAttribute("user") CustomUserDetails user,
                                                                   @PathVariable String id) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(interactionService.listForWidget(id));
    }

    /** The canonical onboarding milestone checklist a tracker starts from. */
    @GetMapping("/onboarding-template")
    public ResponseEntity<List<OnboardingMilestoneTemplateDto>> onboardingTemplate(
            @RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(templateProvider.getTemplate());
    }
}
