package vacademy.io.admin_core_service.features.suborg.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.institute.entity.InstituteSubOrg;
import vacademy.io.admin_core_service.features.suborg.dto.CreateSubOrgSubscriptionDTO;
import vacademy.io.admin_core_service.features.suborg.dto.CreateSubOrgSubscriptionResponseDTO;
import vacademy.io.admin_core_service.features.suborg.dto.SeatUsageDTO;
import vacademy.io.admin_core_service.features.suborg.dto.SubOrgSubscriptionStatusDTO;
import vacademy.io.admin_core_service.features.suborg.service.SubOrgManagementService;
import vacademy.io.admin_core_service.features.suborg.service.SubOrgSubscriptionService;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin-core-service/institute/v1/sub-org")
@RequiredArgsConstructor
@Tag(name = "Sub-Organization Controller", description = "Endpoints for managing sub-organizations")
public class SubOrgController {

    private final SubOrgManagementService subOrgService;
    private final SubOrgSubscriptionService subOrgSubscriptionService;
    private final EnrollInviteRepository enrollInviteRepository;

    @PostMapping("/create")
    public ResponseEntity<String> createSubOrg(
            @RequestBody InstituteInfoDTO instituteInfoDTO,
            @RequestParam String parentInstituteId) {
        return ResponseEntity.ok(subOrgService.createSubOrg(instituteInfoDTO, parentInstituteId));
    }

    @GetMapping("/get-all")
    public ResponseEntity<List<InstituteSubOrg>> getSubOrgs(
            @RequestParam String parentInstituteId) {
        return ResponseEntity.ok(subOrgService.getSubOrgs(parentInstituteId));
    }

    @PostMapping("/create-with-subscription")
    public ResponseEntity<CreateSubOrgSubscriptionResponseDTO> createSubOrgWithSubscription(
            @RequestBody CreateSubOrgSubscriptionDTO request,
            @RequestParam String parentInstituteId) {
        return ResponseEntity.ok(
                subOrgSubscriptionService.createSubOrgWithSubscription(request, parentInstituteId));
    }

    @GetMapping("/scoped-invites")
    public ResponseEntity<List<EnrollInviteDTO>> getScopedInvites(
            @RequestParam String subOrgId,
            @RequestParam String instituteId) {
        List<EnrollInvite> invites = enrollInviteRepository
                .findBySubOrgIdAndInstituteId(subOrgId, instituteId,
                        List.of(StatusEnum.ACTIVE.name()));
        List<EnrollInviteDTO> dtos = invites.stream()
                .map(EnrollInvite::toEnrollInviteDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/seat-usage")
    public ResponseEntity<SeatUsageDTO> getSeatUsage(
            @RequestParam String subOrgId,
            @RequestParam String packageSessionId) {
        return ResponseEntity.ok(
                subOrgSubscriptionService.getSeatUsage(subOrgId, packageSessionId));
    }

    @GetMapping("/subscription-status")
    public ResponseEntity<SubOrgSubscriptionStatusDTO> getSubscriptionStatus(
            @RequestParam String subOrgId,
            @RequestParam String instituteId) {
        // Get org-level invite for this sub-org
        List<EnrollInvite> orgInvites = enrollInviteRepository
                .findBySubOrgIdAndInstituteId(subOrgId, instituteId,
                        List.of(StatusEnum.ACTIVE.name(), StatusEnum.DELETED.name()));

        String inviteCode = null;
        String shortUrl = null;
        if (!orgInvites.isEmpty()) {
            inviteCode = orgInvites.get(0).getInviteCode();
            shortUrl = orgInvites.get(0).getShortUrl();
        }

        // Get scoped invites to build seat usage list
        List<EnrollInvite> scopedInvites = enrollInviteRepository
                .findBySubOrgIdAndInstituteId(subOrgId, instituteId,
                        List.of(StatusEnum.ACTIVE.name()));

        List<SeatUsageDTO> seatUsages = new ArrayList<>();
        // For each scoped invite, get seat usage from its linked package sessions
        // This is a simplified version - full implementation would resolve package sessions
        // from the invite mappings

        return ResponseEntity.ok(SubOrgSubscriptionStatusDTO.builder()
                .subOrgId(subOrgId)
                .inviteCode(inviteCode)
                .shortUrl(shortUrl)
                .seatUsages(seatUsages)
                .build());
    }
}
