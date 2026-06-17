package vacademy.io.community_service.feature.support.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.support.dto.*;
import vacademy.io.community_service.feature.support.enums.SupportPlan;
import vacademy.io.community_service.feature.support.service.SupportConfigService;
import vacademy.io.community_service.feature.support.service.SupportTicketService;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Institute-facing help desk.
 *
 * <p><b>Authorization.</b> Every endpoint requires the caller to hold the {@code ADMIN} role
 * <i>in the institute identified by the {@code clientId} header</i>. The JWT filter only
 * populates {@link CustomUserDetails#getAuthorities()} for the institute matching that header
 * (see CustomUserDetails role-filtering), so {@link #requireAdmin} simultaneously (a) enforces
 * the admin role and (b) confines the caller to their own institute — a caller who spoofs
 * {@code clientId} to another institute gets an empty authority list and is rejected. This
 * mirrors {@code AdminStatusIncidentController.requireAdmin}. Raiser identity is always taken
 * from the authenticated principal, never from the request.
 */
@RestController
@RequestMapping("/community-service/support/v1")
public class SupportAdminController {

    private static final String ADMIN_ROLE = "ADMIN";

    @Autowired
    private SupportTicketService ticketService;

    @Autowired
    private SupportConfigService configService;

    /** The full plan catalogue — frontends render SLA text from this rather than hardcoding it. */
    @GetMapping("/plans")
    public ResponseEntity<List<SupportPlanDto>> plans(@RequestAttribute("user") CustomUserDetails user) {
        requireAdmin(user);
        return ResponseEntity.ok(Arrays.stream(SupportPlan.values())
                .map(SupportPlanDto::from)
                .collect(Collectors.toList()));
    }

    /** This institute's plan + dedicated engineers + open-ticket count. */
    @GetMapping("/config")
    public ResponseEntity<SupportConfigDto> config(@RequestAttribute("user") CustomUserDetails user,
                                                   @RequestHeader(value = "clientId", required = false) String clientId,
                                                   @RequestParam(value = "instituteId", required = false) String instituteIdParam) {
        requireAdmin(user);
        return ResponseEntity.ok(configService.getAdminConfig(resolveInstituteId(clientId, instituteIdParam)));
    }

    @GetMapping("/tickets")
    public ResponseEntity<PageResponseDto<SupportTicketDto>> myTickets(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestHeader(value = "clientId", required = false) String clientId,
            @RequestParam(value = "instituteId", required = false) String instituteIdParam,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        requireAdmin(user);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100));
        return ResponseEntity.ok(ticketService.listForInstitute(
                resolveInstituteId(clientId, instituteIdParam), status, pageable));
    }

    @PostMapping("/tickets")
    public ResponseEntity<SupportTicketDto> createTicket(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestHeader(value = "clientId", required = false) String clientId,
            @RequestParam(value = "instituteId", required = false) String instituteIdParam,
            @RequestParam(value = "instituteName", required = false) String instituteName,
            @RequestBody CreateTicketRequest request) {
        requireAdmin(user);
        String instituteId = resolveInstituteId(clientId, instituteIdParam);
        // Raiser identity is taken from the authenticated principal only — never from the request.
        SupportTicketDto dto = ticketService.createTicket(
                instituteId, instituteName,
                user.getUserId(), user.getFullName(), user.getUsername(), "ADMIN", request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/tickets/{id}")
    public ResponseEntity<SupportTicketDto> getTicket(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestHeader(value = "clientId", required = false) String clientId,
            @RequestParam(value = "instituteId", required = false) String instituteIdParam,
            @PathVariable String id) {
        requireAdmin(user);
        return ResponseEntity.ok(ticketService.getForInstitute(resolveInstituteId(clientId, instituteIdParam), id));
    }

    @PostMapping("/tickets/{id}/messages")
    public ResponseEntity<SupportTicketDto> reply(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestHeader(value = "clientId", required = false) String clientId,
            @RequestParam(value = "instituteId", required = false) String instituteIdParam,
            @PathVariable String id,
            @RequestBody AddMessageRequest request) {
        requireAdmin(user);
        // Customers never post internal notes.
        if (request != null) {
            request.setInternalNote(false);
        }
        return ResponseEntity.ok(ticketService.addCustomerMessage(
                resolveInstituteId(clientId, instituteIdParam), id, user, request));
    }

    @PostMapping("/tickets/{id}/status")
    public ResponseEntity<SupportTicketDto> setStatus(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestHeader(value = "clientId", required = false) String clientId,
            @RequestParam(value = "instituteId", required = false) String instituteIdParam,
            @PathVariable String id,
            @RequestBody UpdateTicketStatusRequest request) {
        requireAdmin(user);
        String statusValue = request != null ? request.getStatus() : null;
        return ResponseEntity.ok(ticketService.setStatusByCustomer(
                resolveInstituteId(clientId, instituteIdParam), id, statusValue));
    }

    // ---------------------------------------------------------------------

    /**
     * Requires the caller to be an ADMIN of the institute named by the {@code clientId} header.
     * We deliberately check ONLY the flat (clientId-scoped) authority list — no "admin in any
     * institute" fallback — so the role check doubles as the tenant-isolation guard.
     */
    private void requireAdmin(CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        boolean isAdmin = user.getAuthorities() != null && user.getAuthorities().stream()
                .anyMatch(a -> ADMIN_ROLE.equalsIgnoreCase(a.getAuthority()));
        if (!isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Admin access required for this institute");
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
