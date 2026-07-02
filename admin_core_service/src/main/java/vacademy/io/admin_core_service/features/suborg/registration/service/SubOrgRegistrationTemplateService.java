package vacademy.io.admin_core_service.features.suborg.registration.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldTypeEnum;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.enums.EnrollInviteTag;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.enroll_invite.service.PackageSessionEnrollInviteToPaymentOptionService;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.admin_core_service.features.suborg.registration.dto.CreateRegistrationTemplateDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.RegistrationListItemDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.TemplateListItemDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationSettingDTO;
import vacademy.io.admin_core_service.features.suborg.registration.enums.SubOrgRegistrationStatus;
import vacademy.io.admin_core_service.features.suborg.registration.repository.SubOrgRegistrationRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Admin-side operations for open sub-org registration templates.
 *
 * A template is an EnrollInvite with tag=SUB_ORG_REGISTRATION, sub_org_id=null,
 * PSLIPO rows (backed by a FREE option in P0) defining the fixed course grant, and a
 * SUB_ORG_REGISTRATION_SETTING block in setting_json. Modeled on
 * SubOrgSubscriptionService.createSubOrgWithSubscription — NOT on the generic
 * learner-invitation flow — so templates never leak into existing invite lists.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubOrgRegistrationTemplateService {

    private final EnrollInviteRepository enrollInviteRepository;
    private final PaymentOptionRepository paymentOptionRepository;
    private final PackageSessionService packageSessionService;
    private final PackageSessionEnrollInviteToPaymentOptionService pslipoService;
    private final InstituteCustomFiledService instituteCustomFiledService;
    private final SubOrgRegistrationRepository registrationRepository;

    @Transactional
    public Map<String, Object> createTemplate(CreateRegistrationTemplateDTO request, String instituteId) {
        if (!StringUtils.hasText(instituteId)) {
            throw new VacademyException("instituteId is required");
        }
        if (!StringUtils.hasText(request.getName())) {
            throw new VacademyException("Template name is required");
        }
        if (CollectionUtils.isEmpty(request.getPackageSessionIds())) {
            throw new VacademyException("At least one package session is required");
        }

        EnrollInvite invite = new EnrollInvite();
        invite.setName(request.getName());
        invite.setTag(EnrollInviteTag.SUB_ORG_REGISTRATION.name());
        invite.setStatus(StatusEnum.ACTIVE.name());
        invite.setInstituteId(instituteId);
        invite.setInviteCode(generateInviteCode());
        invite.setIsBundled(request.getPackageSessionIds().size() > 1);
        invite.setLearnerAccessDays(request.getValidityInDays());
        invite.setSettingJson(SubOrgRegistrationSettings.serialize(buildSettings(request)));
        invite = enrollInviteRepository.save(invite);
        log.info("Created SUB_ORG_REGISTRATION template invite id={} institute={}",
                invite.getId(), instituteId);

        // P0: templates are FREE — one FREE option+plan backs every PSLIPO row.
        PaymentOption option = new PaymentOption();
        option.setName("Sub-Org Registration: " + request.getName());
        option.setType(PaymentOptionType.FREE.name());
        option.setTag("DEFAULT");
        option.setStatus(StatusEnum.ACTIVE.name());
        option.setRequireApproval(false);
        option = paymentOptionRepository.save(option);

        PaymentPlan plan = new PaymentPlan();
        plan.setName("Sub-Org Registration Plan");
        plan.setStatus(StatusEnum.ACTIVE.name());
        plan.setActualPrice(0);
        plan.setElevatedPrice(0);
        plan.setTag("DEFAULT");
        plan.setMemberCount(request.getMemberCount());
        plan.setValidityInDays(request.getValidityInDays());
        plan.setPaymentOption(option);
        option.getPaymentPlans().add(plan);
        paymentOptionRepository.save(option);

        List<PackageSessionLearnerInvitationToPaymentOption> mappings = new ArrayList<>();
        for (String psId : request.getPackageSessionIds()) {
            PackageSession ps = packageSessionService.findById(psId);
            mappings.add(new PackageSessionLearnerInvitationToPaymentOption(
                    invite, ps, option, StatusEnum.ACTIVE.name()));
        }
        pslipoService.createPackageSessionLearnerInvitationToPaymentOptions(mappings);

        if (!CollectionUtils.isEmpty(request.getInstituteCustomFields())) {
            instituteCustomFiledService.syncFeatureCustomFields(
                    instituteId,
                    CustomFieldTypeEnum.ENROLL_INVITE.name(),
                    invite.getId(),
                    request.getInstituteCustomFields());
        }

        return Map.of(
                "template_id", invite.getId(),
                "invite_code", invite.getInviteCode());
    }

    public List<TemplateListItemDTO> listTemplates(String instituteId) {
        if (!StringUtils.hasText(instituteId)) {
            throw new VacademyException("instituteId is required");
        }
        List<EnrollInvite> templates = enrollInviteRepository
                .findByInstituteIdAndTagAndStatusInOrderByCreatedAtDesc(
                        instituteId,
                        EnrollInviteTag.SUB_ORG_REGISTRATION.name(),
                        List.of(StatusEnum.ACTIVE.name(), StatusEnum.INACTIVE.name()));

        List<TemplateListItemDTO> result = new ArrayList<>();
        for (EnrollInvite template : templates) {
            SubOrgRegistrationSettingDTO.RegistrationSetting setting =
                    SubOrgRegistrationSettings.parse(template.getSettingJson());
            result.add(TemplateListItemDTO.builder()
                    .id(template.getId())
                    .name(template.getName())
                    .inviteCode(template.getInviteCode())
                    .status(template.getStatus())
                    .createdAt(template.getCreatedAt())
                    .completedCount(registrationRepository.countByTemplateInviteIdAndStatus(
                            template.getId(), SubOrgRegistrationStatus.COMPLETED.name()))
                    .totalAttempts(registrationRepository.countByTemplateInviteId(template.getId()))
                    .maxRegistrations(setting != null ? setting.getMaxRegistrations() : null)
                    .steps(setting != null ? setting.getSteps() : null)
                    .build());
        }
        return result;
    }

    @Transactional
    public Map<String, Object> updateStatus(String templateId, String status, String instituteId) {
        if (!StatusEnum.ACTIVE.name().equalsIgnoreCase(status)
                && !StatusEnum.INACTIVE.name().equalsIgnoreCase(status)) {
            throw new VacademyException("Status must be ACTIVE or INACTIVE");
        }
        EnrollInvite template = requireTemplate(templateId, instituteId);
        template.setStatus(status.toUpperCase());
        enrollInviteRepository.save(template);
        return Map.of("template_id", template.getId(), "status", template.getStatus());
    }

    public List<RegistrationListItemDTO> listRegistrations(String templateId, String instituteId) {
        requireTemplate(templateId, instituteId);
        List<RegistrationListItemDTO> result = new ArrayList<>();
        registrationRepository.findByTemplateInviteIdOrderByCreatedAtDesc(templateId)
                .forEach(r -> result.add(RegistrationListItemDTO.builder()
                        .id(r.getId())
                        .status(r.getStatus())
                        .orgName(r.getOrgName())
                        .adminName(r.getAdminName())
                        .adminEmail(r.getAdminEmail())
                        .adminPhone(r.getAdminPhone())
                        .spawnedSubOrgId(r.getSpawnedSubOrgId())
                        .createdAt(r.getCreatedAt())
                        .build()));
        return result;
    }

    private EnrollInvite requireTemplate(String templateId, String instituteId) {
        EnrollInvite template = enrollInviteRepository.findById(templateId)
                .orElseThrow(() -> new VacademyException("Template not found: " + templateId));
        if (!EnrollInviteTag.SUB_ORG_REGISTRATION.name().equals(template.getTag())) {
            throw new VacademyException("Not a sub-org registration template");
        }
        if (!StringUtils.hasText(instituteId) || !instituteId.equals(template.getInstituteId())) {
            throw new VacademyException("Template does not belong to this institute");
        }
        return template;
    }

    private SubOrgRegistrationSettingDTO.RegistrationSetting buildSettings(
            CreateRegistrationTemplateDTO request) {
        SubOrgRegistrationSettingDTO.RegistrationSetting setting =
                new SubOrgRegistrationSettingDTO.RegistrationSetting();
        List<String> steps = new ArrayList<>();
        steps.add("DETAILS");
        if (!CollectionUtils.isEmpty(request.getInstituteCustomFields())) {
            steps.add("CUSTOM_FIELDS");
        }
        if (StringUtils.hasText(request.getTncFileId())) {
            steps.add("TNC");
            setting.setTncFileId(request.getTncFileId());
        }
        setting.setSteps(steps);
        setting.setMaxRegistrations(request.getMaxRegistrations());
        setting.setRequiresApproval(Boolean.TRUE.equals(request.getRequiresApproval()));
        setting.setMemberCount(request.getMemberCount());
        setting.setValidityDays(request.getValidityInDays());
        // recordLearnerRequest REJECTS SUB_ORG enrollments whose invite has no authRoles
        // configured — the spawned org invite inherits these, so they must never be empty.
        setting.setAuthRoles(CollectionUtils.isEmpty(request.getAuthRoles())
                ? List.of("ADMIN")
                : request.getAuthRoles());
        setting.setAdminPermissions(request.getAdminPermissions());
        setting.setAllowedTeamRoles(request.getAllowedTeamRoles());
        return setting;
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
