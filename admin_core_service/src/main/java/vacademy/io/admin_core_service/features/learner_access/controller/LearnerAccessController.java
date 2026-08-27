package vacademy.io.admin_core_service.features.learner_access.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.admin_activity_logs.annotation.Auditable;
import vacademy.io.admin_core_service.features.learner_access.dto.LearnerAccessChangeRequestDTO;
import vacademy.io.admin_core_service.features.learner_access.dto.LearnerAccessChangeResponseDTO;
import vacademy.io.admin_core_service.features.learner_access.dto.LearnerAccessLogDTO;
import vacademy.io.admin_core_service.features.learner_access.service.LearnerAccessService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Learner course-access administration.
 *
 * <ul>
 *   <li>POST /change — extend, shorten, set or unlimit access for N learners at once</li>
 *   <li>GET /history — the audit trail behind one learner's access window</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/v1/learner-access")
@RequiredArgsConstructor
public class LearnerAccessController {

    private final LearnerAccessService learnerAccessService;

    /**
     * Change the access window for the cross product of the requested learners and
     * package sessions. Supports {@code dry_run} for preview.
     */
    // conditionExpr: a dry-run preview mutates nothing, and a request where every
    // enrollment was skipped changed nothing either. Auditing those would claim an
    // access change that never happened.
    @PostMapping("/change")
    @Auditable(
            entityType = "LEARNER",
            action = "ACCESS_CHANGE",
            conditionExpr = "#result?.body != null and !#result.body.dryRun "
                    + "and (#result.body.summary?.updated ?: 0) > 0",
            descriptionExpr = "'changed course access for ' + (#result?.body?.summary?.updated ?: 0) "
                    + "+ ' enrollment(s) of ' + @auditNarrator.learnersFor(#request?.userIds)")
    public ResponseEntity<LearnerAccessChangeResponseDTO> changeAccess(
            @RequestBody LearnerAccessChangeRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        log.info("Learner access change: instituteId={}, users={}, sessions={}, dryRun={}, admin={}",
                request.getInstituteId(),
                request.getUserIds() != null ? request.getUserIds().size() : 0,
                request.getPackageSessionIds() != null ? request.getPackageSessionIds().size() : 0,
                request.isDryRun(),
                userDetails != null ? userDetails.getUserId() : "unknown");

        LearnerAccessChangeResponseDTO response = learnerAccessService.changeAccess(request, userDetails);

        log.info("Learner access change complete: targeted={}, updated={}, skipped={}, failed={}, dryRun={}",
                response.getSummary().getTotalTargeted(),
                response.getSummary().getUpdated(),
                response.getSummary().getSkipped(),
                response.getSummary().getFailed(),
                response.isDryRun());

        return ResponseEntity.ok(response);
    }

    /** Access-change timeline for one learner, newest first. */
    @GetMapping("/history")
    public ResponseEntity<Page<LearnerAccessLogDTO>> getHistory(
            @RequestParam String instituteId,
            @RequestParam String userId,
            @RequestParam(required = false) List<String> packageSessionIds,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        return ResponseEntity.ok(
                learnerAccessService.getHistory(instituteId, userId, packageSessionIds, page, size));
    }
}
