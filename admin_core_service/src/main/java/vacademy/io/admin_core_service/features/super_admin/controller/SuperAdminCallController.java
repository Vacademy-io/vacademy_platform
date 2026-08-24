package vacademy.io.admin_core_service.features.super_admin.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.super_admin.dto.SuperAdminCallDTO;
import vacademy.io.admin_core_service.features.super_admin.dto.SuperAdminCallSummaryDTO;
import vacademy.io.admin_core_service.features.super_admin.dto.TtsCacheSummaryDTO;
import vacademy.io.admin_core_service.features.super_admin.dto.SuperAdminPageResponse;
import vacademy.io.admin_core_service.features.super_admin.service.SuperAdminCallService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;

import java.util.Map;

/**
 * Cross-institute AI call review for the health-check portal.
 *
 * <p>SUPER-ADMIN ONLY, checked on every method. These endpoints deliberately do
 * NOT scope to the caller's institute — that is the whole point of them — so the
 * guard is the only thing standing between this and every institute's call
 * recordings. See the /v1/reports/** IDOR for why that is written down.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/super-admin/v1/calls")
public class SuperAdminCallController {

    @Autowired
    private SuperAdminCallService service;

    @GetMapping
    public ResponseEntity<SuperAdminPageResponse<SuperAdminCallDTO>> list(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(required = false) String instituteId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String health,
            @RequestParam(required = false) String disposition,
            @RequestParam(required = false) String agentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.list(instituteId, from, to, health,
                disposition, agentId, page, Math.min(Math.max(size, 1), 200)));
    }

    @GetMapping("/summary")
    public ResponseEntity<SuperAdminCallSummaryDTO> summary(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(required = false) String instituteId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String health,
            @RequestParam(required = false) String disposition,
            @RequestParam(required = false) String agentId) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.summary(instituteId, from, to, health, disposition, agentId));
    }

    /**
     * TTS speech-cache monitoring: fleet totals plus a per-day series.
     *
     * <p>Lives here rather than proxying the voice bot's own ledger, because the
     * ledger is a snapshot on one box's disk with no history — it can say what is
     * cached right now but never what the hit rate was last Tuesday. Every call's
     * counters land in ai_call_result.diagnostics, so Postgres has the series.
     */
    @GetMapping("/tts-cache/summary")
    public ResponseEntity<TtsCacheSummaryDTO> ttsCacheSummary(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(required = false) String instituteId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String agentId) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.ttsCacheSummary(instituteId, from, to, agentId));
    }

    /** The rate card the costs above were computed from — so the UI can show its work. */
    @GetMapping("/rate-card")
    public ResponseEntity<Map<String, Double>> rateCard(
            @RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.rateCard());
    }
}
