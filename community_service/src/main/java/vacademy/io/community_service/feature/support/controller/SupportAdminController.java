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
 * Institute-facing help desk. The current institute is taken from the {@code clientId} header
 * (set by the admin dashboard and used by the JWT filter), falling back to an explicit param.
 * These paths are not in the security allow-list, so the request is already authenticated.
 */
@RestController
@RequestMapping("/community-service/support/v1")
public class SupportAdminController {

    @Autowired
    private SupportTicketService ticketService;

    @Autowired
    private SupportConfigService configService;

    /** The full plan catalogue — frontends render SLA text from this rather than hardcoding it. */
    @GetMapping("/plans")
    public ResponseEntity<List<SupportPlanDto>> plans() {
        return ResponseEntity.ok(Arrays.stream(SupportPlan.values())
                .map(SupportPlanDto::from)
                .collect(Collectors.toList()));
    }

    /** This institute's plan + dedicated engineers + open-ticket count. */
    @GetMapping("/config")
    public ResponseEntity<SupportConfigDto> config(@RequestAttribute("user") CustomUserDetails user,
                                                   @RequestHeader(value = "clientId", required = false) String clientId,
                                                   @RequestParam(value = "instituteId", required = false) String instituteIdParam) {
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
            @RequestParam(value = "raiserEmail", required = false) String raiserEmail,
            @RequestParam(value = "raiserName", required = false) String raiserName,
            @RequestBody CreateTicketRequest request) {
        String instituteId = resolveInstituteId(clientId, instituteIdParam);
        String email = StringUtils.hasText(raiserEmail) ? raiserEmail : (user != null ? user.getUsername() : null);
        String name = StringUtils.hasText(raiserName) ? raiserName : (user != null ? user.getFullName() : null);
        SupportTicketDto dto = ticketService.createTicket(
                instituteId, instituteName,
                user != null ? user.getUserId() : null, name, email, "ADMIN", request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/tickets/{id}")
    public ResponseEntity<SupportTicketDto> getTicket(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestHeader(value = "clientId", required = false) String clientId,
            @RequestParam(value = "instituteId", required = false) String instituteIdParam,
            @PathVariable String id) {
        return ResponseEntity.ok(ticketService.getForInstitute(resolveInstituteId(clientId, instituteIdParam), id));
    }

    @PostMapping("/tickets/{id}/messages")
    public ResponseEntity<SupportTicketDto> reply(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestHeader(value = "clientId", required = false) String clientId,
            @RequestParam(value = "instituteId", required = false) String instituteIdParam,
            @PathVariable String id,
            @RequestBody AddMessageRequest request) {
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
        String statusValue = request != null ? request.getStatus() : null;
        return ResponseEntity.ok(ticketService.setStatusByCustomer(
                resolveInstituteId(clientId, instituteIdParam), id, statusValue));
    }

    // ---------------------------------------------------------------------

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
