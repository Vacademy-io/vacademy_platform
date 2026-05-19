package vacademy.io.admin_core_service.features.suborg.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteSettingDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.enums.EnrollInviteTag;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.enroll_invite.service.PackageSessionEnrollInviteToPaymentOptionService;
import vacademy.io.admin_core_service.features.fee_management.entity.ComplexPaymentOption;
import vacademy.io.admin_core_service.features.fee_management.repository.ComplexPaymentOptionRepository;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.admin_core_service.features.suborg.dto.CreateSubOrgSubscriptionDTO;
import vacademy.io.admin_core_service.features.suborg.dto.CreateSubOrgSubscriptionResponseDTO;
import vacademy.io.admin_core_service.features.suborg.dto.SeatUsageDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubOrgSubscriptionService {

    private final SubOrgManagementService subOrgManagementService;
    private final EnrollInviteRepository enrollInviteRepository;
    private final PaymentOptionRepository paymentOptionRepository;
    private final PackageSessionService packageSessionService;
    private final PackageSessionEnrollInviteToPaymentOptionService packageSessionEnrollInviteToPaymentOptionService;
    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final ComplexPaymentOptionRepository complexPaymentOptionRepository;
    private final PaymentOptionService paymentOptionService;

    /**
     * Creates a sub-org with an org-level EnrollInvite that the sub-org admin
     * will pay via. This invite is tagged SUB_ORG and linked to the sub-org.
     */
    @Transactional
    public CreateSubOrgSubscriptionResponseDTO createSubOrgWithSubscription(
            CreateSubOrgSubscriptionDTO request, String parentInstituteId) {

        // 1. Create the sub-org (reuse existing logic)
        String subOrgId = subOrgManagementService.createSubOrg(
                request.getSubOrgDetails(), parentInstituteId);
        log.info("Created sub-org with ID: {}", subOrgId);

        // 2. Create the org-level EnrollInvite
        EnrollInvite invite = new EnrollInvite();
        invite.setName("Sub-Org Subscription: " + request.getSubOrgDetails().getInstituteName());
        invite.setTag(EnrollInviteTag.SUB_ORG.name());
        invite.setSubOrgId(subOrgId);
        invite.setStatus(StatusEnum.ACTIVE.name());
        invite.setInstituteId(parentInstituteId);
        invite.setInviteCode(generateInviteCode());
        invite.setIsBundled(request.getPackageSessionIds() != null
                && request.getPackageSessionIds().size() > 1);
        invite.setVendor(request.getVendor());
        invite.setVendorId(request.getVendorId());
        invite.setCurrency(request.getCurrency());
        invite.setLearnerAccessDays(request.getValidityInDays());

        // 3. Resolve PaymentOption.
        //    Non-CPO: fresh PaymentOption + fresh PaymentPlan with seat cap (existing flow).
        //    CPO: reuse the singleton mirror via findOrCreateMirrorForCpo — there's a
        //    UNIQUE constraint on payment_option.complex_payment_option_id, so a brand-new
        //    row collides when the same CPO has already been mirrored (e.g. by a prior
        //    sub-org or by the fee-management UI). Seat cap is carried on settingJson
        //    instead, since the synthetic plan is shared across sub-orgs.
        String paymentType = request.getPaymentType() != null ? request.getPaymentType() : "FREE";
        ComplexPaymentOption cpo = null;
        if (PaymentOptionType.CPO.name().equalsIgnoreCase(paymentType)) {
            if (request.getComplexPaymentOptionId() == null
                    || request.getComplexPaymentOptionId().isBlank()) {
                throw new VacademyException(
                        "complex_payment_option_id is required when payment_type=CPO");
            }
            cpo = complexPaymentOptionRepository
                    .findByIdAndStatusNot(request.getComplexPaymentOptionId(),
                            StatusEnum.DELETED.name())
                    .orElseThrow(() -> new VacademyException(
                            "Fee structure not found: " + request.getComplexPaymentOptionId()));
            if ("PENDING_APPROVAL".equalsIgnoreCase(cpo.getStatus())) {
                throw new VacademyException(
                        "Fee structure is pending approval and cannot back a sub-org subscription");
            }
        }

        // Build settingJson — authRoles for invite-time role override, memberCount for
        // CPO sub-orgs (since the shared synthetic plan can't carry it), and the
        // allow-list of custom roles the sub-org admin can assign when adding their
        // own team members (consumed by /manage-suborg-teams).
        boolean hasAuthRoles = !CollectionUtils.isEmpty(request.getAuthRoles());
        boolean carryMemberCount = cpo != null && request.getMemberCount() != null;
        boolean hasAllowedTeamRoles = !CollectionUtils.isEmpty(request.getAllowedTeamRoles());
        if (hasAuthRoles || carryMemberCount || hasAllowedTeamRoles) {
            try {
                EnrollInviteSettingDTO settingDTO = new EnrollInviteSettingDTO();
                EnrollInviteSettingDTO.Settings settings = new EnrollInviteSettingDTO.Settings();
                EnrollInviteSettingDTO.SubOrgSetting subOrgSetting = new EnrollInviteSettingDTO.SubOrgSetting();
                if (hasAuthRoles) subOrgSetting.setAuthRoles(request.getAuthRoles());
                if (carryMemberCount) subOrgSetting.setMemberCount(request.getMemberCount());
                if (hasAllowedTeamRoles) subOrgSetting.setAllowedTeamRoles(request.getAllowedTeamRoles());
                settings.setSubOrgSetting(subOrgSetting);
                settingDTO.setSetting(settings);
                ObjectMapper mapper = new ObjectMapper();
                invite.setSettingJson(mapper.writeValueAsString(settingDTO));
            } catch (Exception e) {
                log.warn("Failed to serialize sub-org settings: {}", e.getMessage());
            }
        }

        invite = enrollInviteRepository.save(invite);
        log.info("Created org-level EnrollInvite id={} for sub-org={}", invite.getId(), subOrgId);

        PaymentOption option;
        if (cpo != null) {
            // Reuse the singleton mirror. Idempotent — handles "this CPO already has a mirror".
            option = paymentOptionService.findOrCreateMirrorForCpo(cpo);
            log.info("Reusing CPO mirror PaymentOption id={} for cpoId={}",
                    option.getId(), cpo.getId());
        } else {
            option = new PaymentOption();
            option.setName("Sub-Org Plan: " + request.getSubOrgDetails().getInstituteName());
            option.setType(paymentType);
            option.setTag("DEFAULT");
            option.setStatus(StatusEnum.ACTIVE.name());
            option.setRequireApproval(false);
            option = paymentOptionRepository.save(option);
            log.info("Created PaymentOption id={} type={}", option.getId(), option.getType());

            // 4. Per-sub-org PaymentPlan carries the seat cap for the non-CPO path.
            PaymentPlan plan = new PaymentPlan();
            plan.setName("Sub-Org Plan");
            plan.setStatus(StatusEnum.ACTIVE.name());
            plan.setActualPrice(request.getActualPrice() != null ? request.getActualPrice() : 0);
            plan.setElevatedPrice(request.getElevatedPrice() != null ? request.getElevatedPrice() : 0);
            plan.setCurrency(request.getCurrency());
            plan.setTag("DEFAULT");
            plan.setMemberCount(request.getMemberCount());
            plan.setValidityInDays(request.getValidityInDays());
            plan.setPaymentOption(option);
            option.getPaymentPlans().add(plan);
            paymentOptionRepository.save(option);
            log.info("Created PaymentPlan with memberCount={}", request.getMemberCount());
        }

        // 5. Link invite to each package session
        if (!CollectionUtils.isEmpty(request.getPackageSessionIds())) {
            List<PackageSessionLearnerInvitationToPaymentOption> mappings = new ArrayList<>();
            for (String psId : request.getPackageSessionIds()) {
                PackageSession ps = packageSessionService.findById(psId);
                PackageSessionLearnerInvitationToPaymentOption mapping =
                        new PackageSessionLearnerInvitationToPaymentOption(
                                invite, ps, option, StatusEnum.ACTIVE.name());
                mappings.add(mapping);
            }
            packageSessionEnrollInviteToPaymentOptionService
                    .createPackageSessionLearnerInvitationToPaymentOptions(mappings);
            log.info("Linked invite to {} package sessions", mappings.size());
        }

        // 6. Create SUBORG_LEARNER invite per PS (for learner enrollment + FSPSSM access).
        // Naming convention: "SubOrgLearner — <Package · Level · Session>" so 3 PSes
        // produce 3 distinguishable invites instead of three identically-named rows.
        if (!CollectionUtils.isEmpty(request.getPackageSessionIds())) {
            for (String psId : request.getPackageSessionIds()) {
                PackageSession ps = packageSessionService.findById(psId);
                String psLabel = buildPsLabel(ps);
                EnrollInvite learnerInvite = new EnrollInvite();
                learnerInvite.setName("SubOrgLearner — " + psLabel);
                learnerInvite.setTag(EnrollInviteTag.SUBORG_LEARNER.name());
                learnerInvite.setSubOrgId(subOrgId);
                learnerInvite.setStatus(StatusEnum.ACTIVE.name());
                learnerInvite.setInstituteId(parentInstituteId);
                learnerInvite.setInviteCode(generateInviteCode());
                learnerInvite.setIsBundled(false);
                learnerInvite.setVendor(request.getVendor());
                learnerInvite.setVendorId(request.getVendorId());
                learnerInvite.setCurrency(request.getCurrency());
                learnerInvite.setLearnerAccessDays(request.getValidityInDays());
                learnerInvite = enrollInviteRepository.save(learnerInvite);

                // Link to PS with same payment option
                PackageSessionLearnerInvitationToPaymentOption learnerMapping =
                        new PackageSessionLearnerInvitationToPaymentOption(
                                learnerInvite, ps, option, StatusEnum.ACTIVE.name());
                packageSessionEnrollInviteToPaymentOptionService
                        .createPackageSessionLearnerInvitationToPaymentOptions(List.of(learnerMapping));
                log.info("Created SUBORG_LEARNER invite id={} name='{}' for sub-org={}, PS={}",
                        learnerInvite.getId(), learnerInvite.getName(), subOrgId, psId);
            }
        }

        return CreateSubOrgSubscriptionResponseDTO.builder()
                .subOrgId(subOrgId)
                .enrollInviteId(invite.getId())
                .inviteCode(invite.getInviteCode())
                .shortUrl(invite.getShortUrl())
                .build();
    }

    /**
     * Auto-creates scoped FREE invites for each package session linked to
     * the org-level invite. Called after the sub-org admin pays.
     */
    @Transactional
    public void createScopedFreeInvites(EnrollInvite orgInvite, UserPlan orgUserPlan,
                                         PaymentPlan orgPlan) {
        String subOrgId = orgInvite.getSubOrgId();
        String instituteId = orgInvite.getInstituteId();

        // For CPO sub-orgs the org PaymentPlan is the shared CPO synthetic plan and
        // carries no per-sub-org memberCount — fall back to settingJson.MEMBER_COUNT.
        Integer fallbackMemberCount = readSubOrgMemberCountFromSettings(orgInvite);

        // Find all package sessions linked to the org-level invite
        List<PackageSessionLearnerInvitationToPaymentOption> orgMappings =
                packageSessionEnrollInviteToPaymentOptionService.findByInvite(orgInvite);

        if (CollectionUtils.isEmpty(orgMappings)) {
            log.warn("No package sessions linked to org invite {}. Skipping scoped invite creation.",
                    orgInvite.getId());
            return;
        }

        for (PackageSessionLearnerInvitationToPaymentOption orgMapping : orgMappings) {
            PackageSession ps = orgMapping.getPackageSession();
            if (ps == null) continue;

            // Check if scoped invite already exists for this sub-org + package session
            if (enrollInviteRepository.findScopedInviteForSubOrgAndPackageSession(
                    subOrgId, ps.getId()).isPresent()) {
                log.info("Scoped invite already exists for sub-org={}, ps={}. Skipping.",
                        subOrgId, ps.getId());
                continue;
            }

            // Create scoped FREE invite
            EnrollInvite scopedInvite = new EnrollInvite();
            scopedInvite.setName("Sub-Org Access: " + ps.getPackageEntity().getPackageName());
            scopedInvite.setTag(EnrollInviteTag.SUB_ORG.name());
            scopedInvite.setSubOrgId(subOrgId);
            scopedInvite.setStatus(StatusEnum.ACTIVE.name());
            scopedInvite.setInstituteId(instituteId);
            scopedInvite.setInviteCode(generateInviteCode());
            scopedInvite.setIsBundled(false);
            scopedInvite.setLearnerAccessDays(
                    orgPlan != null ? orgPlan.getValidityInDays() : orgInvite.getLearnerAccessDays());
            scopedInvite = enrollInviteRepository.save(scopedInvite);

            // Create FREE PaymentOption
            PaymentOption freeOption = new PaymentOption();
            freeOption.setName("Free Access (Sub-Org)");
            freeOption.setType("FREE");
            freeOption.setTag("DEFAULT");
            freeOption.setStatus(StatusEnum.ACTIVE.name());
            freeOption.setRequireApproval(false);
            freeOption = paymentOptionRepository.save(freeOption);

            // Create PaymentPlan with seat cap from org plan
            PaymentPlan freePlan = new PaymentPlan();
            freePlan.setName("Sub-Org Free Plan");
            freePlan.setStatus(StatusEnum.ACTIVE.name());
            freePlan.setActualPrice(0);
            freePlan.setElevatedPrice(0);
            freePlan.setTag("DEFAULT");
            Integer planMemberCount = orgPlan != null ? orgPlan.getMemberCount() : null;
            freePlan.setMemberCount(planMemberCount != null ? planMemberCount : fallbackMemberCount);
            freePlan.setValidityInDays(orgPlan != null ? orgPlan.getValidityInDays()
                    : orgInvite.getLearnerAccessDays());
            freePlan.setPaymentOption(freeOption);
            freeOption.getPaymentPlans().add(freePlan);
            paymentOptionRepository.save(freeOption);

            // Link scoped invite to package session
            PackageSessionLearnerInvitationToPaymentOption link =
                    new PackageSessionLearnerInvitationToPaymentOption(
                            scopedInvite, ps, freeOption, StatusEnum.ACTIVE.name());
            packageSessionEnrollInviteToPaymentOptionService
                    .createPackageSessionLearnerInvitationToPaymentOptions(List.of(link));

            log.info("Created scoped FREE invite id={} for sub-org={}, ps={}",
                    scopedInvite.getId(), subOrgId, ps.getId());
        }
    }

    /**
     * Returns seat usage for a sub-org in a specific package session.
     */
    public SeatUsageDTO getSeatUsage(String subOrgId, String packageSessionId) {
        PackageSession ps = packageSessionService.findById(packageSessionId);

        long usedSeats = mappingRepository.countBySubOrgIdAndPackageSessionIdAndStatus(
                subOrgId, packageSessionId, LearnerSessionStatusEnum.ACTIVE.name());

        // Find the scoped invite's plan to get totalSeats
        Integer totalSeats = null;
        Optional<EnrollInvite> scopedInvite = enrollInviteRepository
                .findScopedInviteForSubOrgAndPackageSession(subOrgId, packageSessionId);
        if (scopedInvite.isPresent()) {
            List<PackageSessionLearnerInvitationToPaymentOption> inviteMappings =
                    packageSessionEnrollInviteToPaymentOptionService.findByInvite(scopedInvite.get());
            for (PackageSessionLearnerInvitationToPaymentOption mapping : inviteMappings) {
                if (mapping.getPaymentOption() != null
                        && mapping.getPaymentOption().getPaymentPlans() != null) {
                    for (PaymentPlan plan : mapping.getPaymentOption().getPaymentPlans()) {
                        if (plan.getMemberCount() != null) {
                            totalSeats = plan.getMemberCount();
                            break;
                        }
                    }
                }
                if (totalSeats != null) break;
            }
        }

        return SeatUsageDTO.builder()
                .packageSessionId(packageSessionId)
                .packageName(ps.getPackageEntity() != null
                        ? ps.getPackageEntity().getPackageName() : null)
                .usedSeats(usedSeats)
                .totalSeats(totalSeats)
                .build();
    }

    /**
     * Deactivates all scoped FREE invites for a sub-org (called on org plan expiry).
     */
    @Transactional
    public void deactivateScopedInvites(String subOrgId, String instituteId) {
        List<EnrollInvite> scopedInvites = enrollInviteRepository
                .findBySubOrgIdAndInstituteId(subOrgId, instituteId,
                        List.of(StatusEnum.ACTIVE.name()));

        for (EnrollInvite invite : scopedInvites) {
            invite.setStatus(StatusEnum.DELETED.name());
            enrollInviteRepository.save(invite);
            log.info("Deactivated scoped invite id={} for sub-org={}", invite.getId(), subOrgId);
        }
    }

    /**
     * Replaces the ALLOWED_TEAM_ROLES list on the sub-org's org-level invite settingJson.
     * Idempotent. Pass an empty list to clear the restriction.
     */
    @Transactional
    public List<String> updateAllowedTeamRoles(String subOrgId, String parentInstituteId,
                                               List<String> allowedRoles) {
        if (!StringUtils.hasText(subOrgId)) {
            throw new VacademyException("sub_org_id is required");
        }
        if (!StringUtils.hasText(parentInstituteId)) {
            throw new VacademyException("parent_institute_id is required");
        }
        List<EnrollInvite> candidates = enrollInviteRepository
                .findBySubOrgIdAndInstituteId(subOrgId, parentInstituteId,
                        List.of(StatusEnum.ACTIVE.name()));
        if (candidates.isEmpty()) {
            throw new VacademyException("No active org-level invite found for sub-org " + subOrgId);
        }
        EnrollInvite invite = candidates.get(0);

        ObjectMapper mapper = new ObjectMapper();
        EnrollInviteSettingDTO dto;
        try {
            dto = StringUtils.hasText(invite.getSettingJson())
                    ? mapper.readValue(invite.getSettingJson(), EnrollInviteSettingDTO.class)
                    : new EnrollInviteSettingDTO();
        } catch (Exception e) {
            log.warn("Could not parse existing settingJson for invite {}; recreating", invite.getId());
            dto = new EnrollInviteSettingDTO();
        }
        if (dto.getSetting() == null) dto.setSetting(new EnrollInviteSettingDTO.Settings());
        EnrollInviteSettingDTO.SubOrgSetting subSetting = dto.getSetting().getSubOrgSetting();
        if (subSetting == null) {
            subSetting = new EnrollInviteSettingDTO.SubOrgSetting();
            dto.getSetting().setSubOrgSetting(subSetting);
        }
        subSetting.setAllowedTeamRoles(allowedRoles);

        try {
            invite.setSettingJson(mapper.writeValueAsString(dto));
            enrollInviteRepository.save(invite);
        } catch (Exception e) {
            throw new VacademyException("Failed to persist allowed_team_roles: " + e.getMessage());
        }
        log.info("Updated allowed_team_roles for sub-org={} to {}", subOrgId, allowedRoles);
        return allowedRoles != null ? allowedRoles : List.of();
    }

    private Integer readSubOrgMemberCountFromSettings(EnrollInvite invite) {
        if (invite == null || !StringUtils.hasText(invite.getSettingJson())) return null;
        try {
            EnrollInviteSettingDTO dto = new ObjectMapper()
                    .readValue(invite.getSettingJson(), EnrollInviteSettingDTO.class);
            return Optional.ofNullable(dto)
                    .map(EnrollInviteSettingDTO::getSetting)
                    .map(EnrollInviteSettingDTO.Settings::getSubOrgSetting)
                    .map(EnrollInviteSettingDTO.SubOrgSetting::getMemberCount)
                    .orElse(null);
        } catch (Exception e) {
            log.debug("Could not read MEMBER_COUNT from settingJson for invite {}: {}",
                    invite.getId(), e.getMessage());
            return null;
        }
    }

    /**
     * Builds a human-friendly PS label for invite naming, joining package / level / session
     * with " · " separators. Falls back to the PS id when nothing else is available.
     */
    private String buildPsLabel(PackageSession ps) {
        if (ps == null) return "unknown";
        String pkg = ps.getPackageEntity() != null ? ps.getPackageEntity().getPackageName() : null;
        String level = ps.getLevel() != null ? ps.getLevel().getLevelName() : null;
        String session = ps.getSession() != null ? ps.getSession().getSessionName() : null;
        StringBuilder sb = new StringBuilder();
        if (StringUtils.hasText(pkg)) sb.append(pkg);
        if (StringUtils.hasText(level)) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append(level);
        }
        if (StringUtils.hasText(session)) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append(session);
        }
        return sb.length() > 0 ? sb.toString() : ps.getId();
    }

    private String generateInviteCode() {
        String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
