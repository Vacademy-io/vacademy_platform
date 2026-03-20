package vacademy.io.admin_core_service.features.suborg.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteSettingDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.enums.EnrollInviteTag;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.enroll_invite.service.PackageSessionEnrollInviteToPaymentOptionService;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.admin_core_service.features.suborg.dto.CreateSubOrgSubscriptionDTO;
import vacademy.io.admin_core_service.features.suborg.dto.CreateSubOrgSubscriptionResponseDTO;
import vacademy.io.admin_core_service.features.suborg.dto.SeatUsageDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
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

        // Build settingJson with auth roles if provided
        if (!CollectionUtils.isEmpty(request.getAuthRoles())) {
            try {
                EnrollInviteSettingDTO settingDTO = new EnrollInviteSettingDTO();
                EnrollInviteSettingDTO.Settings settings = new EnrollInviteSettingDTO.Settings();
                EnrollInviteSettingDTO.SubOrgSetting subOrgSetting = new EnrollInviteSettingDTO.SubOrgSetting();
                subOrgSetting.setAuthRoles(request.getAuthRoles());
                settings.setSubOrgSetting(subOrgSetting);
                settingDTO.setSetting(settings);
                ObjectMapper mapper = new ObjectMapper();
                invite.setSettingJson(mapper.writeValueAsString(settingDTO));
            } catch (Exception e) {
                log.warn("Failed to serialize authRoles to settingJson: {}", e.getMessage());
            }
        }

        invite = enrollInviteRepository.save(invite);
        log.info("Created org-level EnrollInvite id={} for sub-org={}", invite.getId(), subOrgId);

        // 3. Create PaymentOption
        PaymentOption option = new PaymentOption();
        option.setName("Sub-Org Plan: " + request.getSubOrgDetails().getInstituteName());
        option.setType(request.getPaymentType() != null ? request.getPaymentType() : "FREE");
        option.setTag("DEFAULT");
        option.setStatus(StatusEnum.ACTIVE.name());
        option.setRequireApproval(false);
        option = paymentOptionRepository.save(option);
        log.info("Created PaymentOption id={}", option.getId());

        // 4. Create PaymentPlan
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
            freePlan.setMemberCount(orgPlan != null ? orgPlan.getMemberCount() : null);
            freePlan.setValidityInDays(orgPlan != null ? orgPlan.getValidityInDays() : null);
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
