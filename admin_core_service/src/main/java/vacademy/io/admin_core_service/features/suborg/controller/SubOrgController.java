package vacademy.io.admin_core_service.features.suborg.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.enroll_invite.service.PackageSessionEnrollInviteToPaymentOptionService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.admin_core_service.features.institute.entity.InstituteSubOrg;
import vacademy.io.admin_core_service.features.suborg.dto.CreateSubOrgSubscriptionDTO;
import vacademy.io.admin_core_service.features.suborg.dto.CreateSubOrgSubscriptionResponseDTO;
import vacademy.io.admin_core_service.features.suborg.dto.SeatUsageDTO;
import vacademy.io.admin_core_service.features.suborg.dto.SubOrgFinanceDetailDTO;
import vacademy.io.admin_core_service.features.suborg.dto.SubOrgSubscriptionStatusDTO;
import vacademy.io.admin_core_service.features.suborg.service.SubOrgFinanceService;
import vacademy.io.admin_core_service.features.suborg.service.SubOrgManagementService;
import vacademy.io.admin_core_service.features.suborg.service.SubOrgSubscriptionService;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin-core-service/institute/v1/sub-org")
@RequiredArgsConstructor
@Tag(name = "Sub-Organization Controller", description = "Endpoints for managing sub-organizations")
public class SubOrgController {

    private final SubOrgManagementService subOrgService;
    private final SubOrgSubscriptionService subOrgSubscriptionService;
    private final SubOrgFinanceService subOrgFinanceService;
    private final EnrollInviteRepository enrollInviteRepository;
    private final PackageSessionEnrollInviteToPaymentOptionService pslipoService;

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

    /**
     * Update the allow-list of custom roles a sub-org admin may assign on
     * /manage-suborg-teams. Body: {"allowed_team_roles": ["RoleA","RoleB"]} —
     * pass an empty list to clear (no restriction).
     */
    @org.springframework.web.bind.annotation.PatchMapping("/{subOrgId}/team-roles")
    public ResponseEntity<java.util.Map<String, Object>> updateAllowedTeamRoles(
            @org.springframework.web.bind.annotation.PathVariable String subOrgId,
            @RequestParam String parentInstituteId,
            @RequestBody java.util.Map<String, Object> body) {
        Object raw = body != null ? body.get("allowed_team_roles") : null;
        List<String> roles = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object o : list) {
                if (o != null) roles.add(String.valueOf(o));
            }
        }
        List<String> saved = subOrgSubscriptionService
                .updateAllowedTeamRoles(subOrgId, parentInstituteId, roles);
        java.util.Map<String, Object> out = new HashMap<>();
        out.put("sub_org_id", subOrgId);
        out.put("allowed_team_roles", saved);
        return ResponseEntity.ok(out);
    }

    /**
     * Returns each ACTIVE invite for the sub-org enriched with the package sessions it
     * grants access to (package name + level name + session name). Earlier versions only
     * returned EnrollInviteDTO, which doesn't carry PS info — so the frontend couldn't
     * show the courses picked at creation time and tripped over "no package session"
     * checks on bundled org-level invites.
     */
    @GetMapping("/scoped-invites")
    public ResponseEntity<List<Map<String, Object>>> getScopedInvites(
            @RequestParam String subOrgId,
            @RequestParam String instituteId) {
        List<EnrollInvite> invites = enrollInviteRepository
                .findBySubOrgIdAndInstituteId(subOrgId, instituteId,
                        List.of(StatusEnum.ACTIVE.name()));
        List<Map<String, Object>> out = new ArrayList<>(invites.size());
        for (EnrollInvite invite : invites) {
            EnrollInviteDTO base = invite.toEnrollInviteDTO();
            Map<String, Object> row = new HashMap<>();
            row.put("id", base.getId());
            row.put("name", base.getName());
            row.put("invite_code", base.getInviteCode());
            row.put("status", base.getStatus());
            row.put("tag", base.getTag());
            row.put("is_bundled", base.getIsBundled());
            row.put("sub_org_id", base.getSubOrgId());
            row.put("learner_access_days", base.getLearnerAccessDays());
            // Frontend needs settingJson to pre-fill the admin's role (authRoles) on the
            // Add User form without re-asking the admin.
            row.put("setting_json", base.getSettingJson());

            // Hoist allowed_team_roles up to a top-level field so the FE doesn't have to
            // parse settingJson just to filter the /manage-suborg-teams add-member dropdown.
            try {
                if (org.springframework.util.StringUtils.hasText(base.getSettingJson())) {
                    com.fasterxml.jackson.databind.ObjectMapper m = new com.fasterxml.jackson.databind.ObjectMapper();
                    var parsed = m.readValue(base.getSettingJson(),
                            vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteSettingDTO.class);
                    if (parsed != null && parsed.getSetting() != null
                            && parsed.getSetting().getSubOrgSetting() != null) {
                        row.put("allowed_team_roles",
                                parsed.getSetting().getSubOrgSetting().getAllowedTeamRoles());
                    }
                }
            } catch (Exception ignored) { /* leave field absent on parse failure */ }

            List<PackageSessionLearnerInvitationToPaymentOption> links = pslipoService.findByInvite(invite);
            List<Map<String, Object>> psRows = new ArrayList<>();
            String paymentType = null;
            String complexPaymentOptionId = null;
            for (PackageSessionLearnerInvitationToPaymentOption link : links) {
                PackageSession ps = link.getPackageSession();
                if (ps == null) continue;
                Map<String, Object> psRow = new HashMap<>();
                psRow.put("id", ps.getId());
                psRow.put("package_name", ps.getPackageEntity() != null
                        ? ps.getPackageEntity().getPackageName() : null);
                psRow.put("level_name", ps.getLevel() != null
                        ? ps.getLevel().getLevelName() : null);
                psRow.put("session_name", ps.getSession() != null
                        ? ps.getSession().getSessionName() : null);
                psRows.add(psRow);

                // Use the link's PaymentOption to surface payment_type + cpo id once. All
                // links on a given invite share the same PaymentOption, so reading from the
                // first non-null one is enough.
                PaymentOption opt = link.getPaymentOption();
                if (opt != null && paymentType == null) {
                    paymentType = opt.getType();
                    complexPaymentOptionId = opt.getComplexPaymentOptionId();
                }
            }
            row.put("package_sessions", psRows);
            row.put("payment_type", paymentType);
            row.put("complex_payment_option_id", complexPaymentOptionId);
            out.add(row);
        }
        return ResponseEntity.ok(out);
    }

    @GetMapping("/seat-usage")
    public ResponseEntity<SeatUsageDTO> getSeatUsage(
            @RequestParam String subOrgId,
            @RequestParam String packageSessionId) {
        return ResponseEntity.ok(
                subOrgSubscriptionService.getSeatUsage(subOrgId, packageSessionId));
    }

    /**
     * Detail panel for {@code /manage-sub-orgs}: admin-level payment summary (CPO installments
     * included when the sub-org was bought via CPO) + learner roster with outstanding dues.
     */
    @GetMapping("/finance-detail")
    public ResponseEntity<SubOrgFinanceDetailDTO> getFinanceDetail(
            @RequestParam String subOrgId,
            @RequestParam(required = false) String parentInstituteId) {
        return ResponseEntity.ok(subOrgFinanceService.getFinanceDetail(subOrgId, parentInstituteId));
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
