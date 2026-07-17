package vacademy.io.community_service.feature.support.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;
import vacademy.io.community_service.feature.support.dto.*;
import vacademy.io.community_service.feature.support.enums.SupportPlan;
import vacademy.io.community_service.feature.support.service.SupportConfigService;
import vacademy.io.community_service.feature.support.service.SupportEngineerService;
import vacademy.io.community_service.feature.support.service.SupportTicketService;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * The super-admin support console (Intercom-style). Every method requires a root user.
 * Served under the {@code /super-admin/v1} prefix the health-check dashboard already targets.
 */
@RestController
@RequestMapping("/community-service/super-admin/v1/support")
public class SupportSuperAdminController {

    @Autowired
    private SupportTicketService ticketService;
    @Autowired
    private SupportEngineerService engineerService;
    @Autowired
    private SupportConfigService configService;

    // ---- catalogue ---------------------------------------------------------------

    @GetMapping("/plans")
    public ResponseEntity<List<SupportPlanDto>> plans(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(Arrays.stream(SupportPlan.values())
                .map(SupportPlanDto::from).collect(Collectors.toList()));
    }

    // ---- inbox -------------------------------------------------------------------

    /**
     * @param instituteId  single-institute filter (kept for existing callers/deep links)
     * @param instituteIds multi-institute filter (repeated or comma-separated); unioned with
     *                     {@code instituteId}. Empty/absent means all institutes.
     */
    @GetMapping("/tickets")
    public ResponseEntity<PageResponseDto<SupportTicketDto>> tickets(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(value = "instituteId", required = false) String instituteId,
            @RequestParam(value = "instituteIds", required = false) List<String> instituteIds,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "engineerId", required = false) String engineerId,
            @RequestParam(value = "overdue", defaultValue = "false") boolean overdue,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100));
        List<String> institutes = new ArrayList<>();
        if (instituteIds != null) {
            institutes.addAll(instituteIds);
        }
        if (instituteId != null) {
            institutes.add(instituteId);
        }
        return ResponseEntity.ok(ticketService.search(institutes, status, engineerId, overdue, pageable));
    }

    @GetMapping("/tickets/counts")
    public ResponseEntity<Map<String, Long>> counts(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(ticketService.inboxCounts());
    }

    @GetMapping("/tickets/{id}")
    public ResponseEntity<SupportTicketDto> ticket(@RequestAttribute("user") CustomUserDetails user,
                                                   @PathVariable String id) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(ticketService.getByIdForSupport(id));
    }

    /** Log a ticket on an institute's behalf (issue reported over email / WhatsApp, etc.). */
    @PostMapping("/tickets")
    public ResponseEntity<SupportTicketDto> createTicket(@RequestAttribute("user") CustomUserDetails user,
                                                         @RequestBody CreateSupportTicketRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(ticketService.createBySupport(request, user));
    }

    /** Edit an existing ticket (fields, internal-only flag, and its opening message/attachments). */
    @PutMapping("/tickets/{id}")
    public ResponseEntity<SupportTicketDto> updateTicket(@RequestAttribute("user") CustomUserDetails user,
                                                         @PathVariable String id,
                                                         @RequestBody UpdateTicketRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(ticketService.updateTicket(id, request));
    }

    /** Set or clear (null eta) the expected-resolution ETA shown to the institute. */
    @PostMapping("/tickets/{id}/eta")
    public ResponseEntity<SupportTicketDto> setEta(@RequestAttribute("user") CustomUserDetails user,
                                                   @PathVariable String id,
                                                   @RequestBody UpdateEtaRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(ticketService.setEta(id, request != null ? request.getEta() : null));
    }

    @PostMapping("/tickets/{id}/messages")
    public ResponseEntity<SupportTicketDto> reply(@RequestAttribute("user") CustomUserDetails user,
                                                  @PathVariable String id,
                                                  @RequestBody AddMessageRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(ticketService.addSupportMessage(id, user, request));
    }

    @PostMapping("/tickets/{id}/assign")
    public ResponseEntity<SupportTicketDto> assign(@RequestAttribute("user") CustomUserDetails user,
                                                   @PathVariable String id,
                                                   @RequestBody AssignEngineerRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(ticketService.assignEngineer(id, request));
    }

    @PostMapping("/tickets/{id}/status")
    public ResponseEntity<SupportTicketDto> status(@RequestAttribute("user") CustomUserDetails user,
                                                   @PathVariable String id,
                                                   @RequestBody UpdateTicketStatusRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(ticketService.updateStatus(id, request));
    }

    // ---- engineers ---------------------------------------------------------------

    @GetMapping("/engineers")
    public ResponseEntity<List<SupportEngineerDto>> engineers(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(engineerService.listAll());
    }

    @PostMapping("/engineers")
    public ResponseEntity<SupportEngineerDto> createEngineer(@RequestAttribute("user") CustomUserDetails user,
                                                             @RequestBody UpsertEngineerRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(engineerService.create(request));
    }

    @PutMapping("/engineers/{id}")
    public ResponseEntity<SupportEngineerDto> updateEngineer(@RequestAttribute("user") CustomUserDetails user,
                                                             @PathVariable String id,
                                                             @RequestBody UpsertEngineerRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(engineerService.update(id, request));
    }

    @DeleteMapping("/engineers/{id}")
    public ResponseEntity<Void> deleteEngineer(@RequestAttribute("user") CustomUserDetails user,
                                               @PathVariable String id) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        engineerService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ---- per-institute config ----------------------------------------------------

    @GetMapping("/institutes/{instituteId}/config")
    public ResponseEntity<InstituteSupportConfigDto> instituteConfig(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String instituteId,
            @RequestParam(value = "instituteName", required = false) String instituteName) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(configService.getSuperAdminConfig(instituteId, instituteName));
    }

    @PutMapping("/institutes/{instituteId}/config")
    public ResponseEntity<InstituteSupportConfigDto> updateInstituteConfig(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String instituteId,
            @RequestBody UpsertInstituteConfigRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(configService.upsertConfig(instituteId, request));
    }

    // ---- global settings ---------------------------------------------------------

    @GetMapping("/settings")
    public ResponseEntity<GlobalSettingsDto> settings(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(configService.getGlobalSettings());
    }

    @PutMapping("/settings")
    public ResponseEntity<GlobalSettingsDto> updateSettings(@RequestAttribute("user") CustomUserDetails user,
                                                            @RequestBody GlobalSettingsDto request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(configService.updateGlobalSettings(
                request != null ? request.getAlertEmails() : null));
    }
}
