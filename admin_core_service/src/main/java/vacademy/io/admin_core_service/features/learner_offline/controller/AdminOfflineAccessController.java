package vacademy.io.admin_core_service.features.learner_offline.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineManifestDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineRuleBulkUpsertRequest;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineRuleDTO;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineAccessRuleService;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineManifestService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Admin API over offline_access_rule (offline plan, Part A1). Node kebab
 * menus / the per-node offline dialog write here; a course's toggle for
 * offlineDefaultEnabled stays on PackageSettingController (COURSE_SETTING).
 */
@RestController
@RequestMapping("/admin-core-service/admin/offline-access/v1")
@RequiredArgsConstructor
public class AdminOfflineAccessController {

    private final OfflineAccessRuleService offlineAccessRuleService;
    private final OfflineManifestService offlineManifestService;

    /** Bulk upsert/delete (allow=null deletes -> "Inherit"). Bumps affected manifest versions. */
    @PostMapping("/rules")
    public ResponseEntity<String> upsertRules(@RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestBody OfflineRuleBulkUpsertRequest request) {
        offlineAccessRuleService.bulkUpsert(instituteId, request.getRules(), user.getUserId());
        return ResponseEntity.ok("Offline access rules saved");
    }

    /** Every explicit rule relevant to a batch (this package session + the course-wide PACKAGE rule). */
    @GetMapping("/rules")
    public ResponseEntity<List<OfflineRuleDTO>> getRules(@RequestAttribute("user") CustomUserDetails user,
            @RequestParam("packageSessionId") String packageSessionId) {
        return ResponseEntity.ok(offlineAccessRuleService.getRules(packageSessionId));
    }

    /**
     * Resolved offline availability for the whole tree of a package session —
     * what a learner's manifest would look like, for the admin preview /
     * §7.4 "N items cannot be downloaded" warning. Reuses OfflineManifestService
     * with the requesting admin's own id (enrollment is not required for this
     * admin-facing read since it goes through OfflineManifestService only for
     * the tree+resolver pass, not the learner-facing endpoint).
     */
    @GetMapping("/effective")
    public ResponseEntity<OfflineManifestDTO> getEffective(@RequestAttribute("user") CustomUserDetails user,
            @RequestParam("packageSessionId") String packageSessionId) {
        return ResponseEntity.ok(offlineManifestService.buildManifestForAdminPreview(packageSessionId));
    }
}
