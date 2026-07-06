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
import vacademy.io.admin_core_service.features.suborg.registration.dto.TemplateDetailDTO;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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

        String paymentType = StringUtils.hasText(request.getPaymentType())
                ? request.getPaymentType().toUpperCase()
                : PaymentOptionType.FREE.name();
        boolean isPaid = PaymentOptionType.ONE_TIME.name().equals(paymentType)
                || PaymentOptionType.SUBSCRIPTION.name().equals(paymentType);
        if (!isPaid && !PaymentOptionType.FREE.name().equals(paymentType)) {
            throw new VacademyException("payment_type must be FREE, ONE_TIME or SUBSCRIPTION");
        }

        // Paid templates reuse an institute-level PaymentOption (price/plans come from it),
        // mirroring the manual create-sub-org modal + SubOrgSubscriptionService's reuse path.
        PaymentOption pickedOption = null;
        if (isPaid) {
            if (!StringUtils.hasText(request.getPaymentOptionId())) {
                throw new VacademyException("payment_option_id is required for paid templates");
            }
            if (!StringUtils.hasText(request.getVendor())) {
                throw new VacademyException("vendor is required for paid templates");
            }
            pickedOption = paymentOptionRepository.findById(request.getPaymentOptionId())
                    .orElseThrow(() -> new VacademyException(
                            "Payment option not found: " + request.getPaymentOptionId()));
            if (StatusEnum.DELETED.name().equalsIgnoreCase(pickedOption.getStatus())) {
                throw new VacademyException("Selected payment option is not active");
            }
            if (StringUtils.hasText(pickedOption.getSourceId())
                    && !instituteId.equals(pickedOption.getSourceId())) {
                throw new VacademyException("Selected payment option does not belong to this institute");
            }
            if (!paymentType.equals(pickedOption.getType())) {
                throw new VacademyException("Selected payment option type does not match payment_type");
            }
            if (!StringUtils.hasText(request.getCurrency())) {
                String planCurrency = pickedOption.getPaymentPlans().stream()
                        .filter(p -> StatusEnum.ACTIVE.name().equals(p.getStatus()))
                        .map(PaymentPlan::getCurrency)
                        .filter(StringUtils::hasText)
                        .findFirst().orElse(null);
                request.setCurrency(planCurrency);
            }
        }

        EnrollInvite invite = new EnrollInvite();
        invite.setName(request.getName());
        invite.setTag(EnrollInviteTag.SUB_ORG_REGISTRATION.name());
        invite.setStatus(StatusEnum.ACTIVE.name());
        invite.setInstituteId(instituteId);
        invite.setInviteCode(generateInviteCode());
        invite.setIsBundled(request.getPackageSessionIds().size() > 1);
        invite.setLearnerAccessDays(request.getValidityInDays());
        invite.setSettingJson(SubOrgRegistrationSettings.serialize(buildSettings(request, paymentType)));
        invite = enrollInviteRepository.save(invite);
        log.info("Created SUB_ORG_REGISTRATION template invite id={} institute={} paymentType={}",
                invite.getId(), instituteId, paymentType);

        PaymentOption option;
        if (pickedOption != null) {
            option = pickedOption;
            log.info("Template {} reuses institute PaymentOption id={} type={}",
                    invite.getId(), option.getId(), option.getType());
        } else {
            // FREE (P0 path): fresh FREE option+plan backs every PSLIPO row.
            option = new PaymentOption();
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
        }

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

    /** Full read-back for the admin edit form (settings + PSLIPO sessions + custom fields). */
    public TemplateDetailDTO getTemplateDetail(String templateId, String instituteId) {
        EnrollInvite template = requireTemplate(templateId, instituteId);
        SubOrgRegistrationSettingDTO.RegistrationSetting setting =
                SubOrgRegistrationSettings.parse(template.getSettingJson());
        String paymentType = setting != null && StringUtils.hasText(setting.getPaymentType())
                ? setting.getPaymentType()
                : PaymentOptionType.FREE.name();
        return TemplateDetailDTO.builder()
                .templateId(template.getId())
                .name(template.getName())
                .inviteCode(template.getInviteCode())
                .status(template.getStatus())
                .packageSessionIds(pslipoService.findPackageSessionsOfEnrollInvite(template))
                .memberCount(setting != null ? setting.getMemberCount() : null)
                .validityInDays(setting != null ? setting.getValidityDays() : template.getLearnerAccessDays())
                .authRoles(setting != null && setting.getAuthRoles() != null
                        ? setting.getAuthRoles() : List.of())
                .adminPermissions(setting != null && setting.getAdminPermissions() != null
                        ? setting.getAdminPermissions() : List.of())
                .allowedTeamRoles(setting != null && setting.getAllowedTeamRoles() != null
                        ? setting.getAllowedTeamRoles() : List.of())
                .tncFileId(setting != null ? setting.getTncFileId() : null)
                .tncConsentItems(setting != null ? setting.getTncConsentItems() : null)
                .maxRegistrations(setting != null ? setting.getMaxRegistrations() : null)
                .kycDocuments(setting != null ? setting.getKycDocuments() : null)
                .orgNameHint(setting != null ? setting.getOrgNameHint() : null)
                .collectAddress(setting != null ? setting.getCollectAddress() : null)
                .kycInstructions(setting != null ? setting.getKycInstructions() : null)
                .completionMessage(setting != null ? setting.getCompletionMessage() : null)
                .completionButtonLabel(setting != null ? setting.getCompletionButtonLabel() : null)
                .completionButtonUrl(setting != null ? setting.getCompletionButtonUrl() : null)
                .completionRedirectUrl(setting != null ? setting.getCompletionRedirectUrl() : null)
                .paymentType(paymentType)
                .paymentOptionId(setting != null ? setting.getPaymentOptionId() : null)
                .vendor(setting != null ? setting.getVendor() : null)
                .currency(setting != null ? setting.getCurrency() : null)
                .instituteCustomFields(instituteCustomFiledService.findCustomFieldsAsJson(
                        template.getInstituteId(),
                        CustomFieldTypeEnum.ENROLL_INVITE.name(),
                        template.getId()))
                .build();
    }

    /**
     * Edits everything EXCEPT the invite code (it IS the distributed public link) and
     * the payment config (payment_type/option/vendor/currency are immutable after
     * create — any payment fields in the request are ignored and the stored ones are
     * reused when rebuilding settings, so the STEPS list keeps/drops PAYMENT correctly).
     */
    @Transactional
    public Map<String, Object> updateTemplate(
            String templateId, String instituteId, CreateRegistrationTemplateDTO request) {
        EnrollInvite template = requireTemplate(templateId, instituteId);
        if (!StringUtils.hasText(request.getName())) {
            throw new VacademyException("Template name is required");
        }
        if (CollectionUtils.isEmpty(request.getPackageSessionIds())) {
            throw new VacademyException("At least one package session is required");
        }

        // Payment config is frozen at create: overwrite whatever the request carries
        // with the stored values before rebuilding settings via buildSettings.
        SubOrgRegistrationSettingDTO.RegistrationSetting existingSetting =
                SubOrgRegistrationSettings.parse(template.getSettingJson());
        String paymentType = existingSetting != null && StringUtils.hasText(existingSetting.getPaymentType())
                ? existingSetting.getPaymentType().toUpperCase()
                : PaymentOptionType.FREE.name();
        request.setPaymentType(paymentType);
        request.setPaymentOptionId(existingSetting != null ? existingSetting.getPaymentOptionId() : null);
        request.setVendor(existingSetting != null ? existingSetting.getVendor() : null);
        request.setVendorId(existingSetting != null ? existingSetting.getVendorId() : null);
        request.setCurrency(existingSetting != null ? existingSetting.getCurrency() : null);
        // requiresApproval isn't exposed to the edit UI — preserve the stored flag
        // so an API-created approval-gated template survives UI edits.
        if (request.getRequiresApproval() == null && existingSetting != null) {
            request.setRequiresApproval(existingSetting.getRequiresApproval());
        }

        // Resolve the current payment option BEFORE touching mappings — for FREE
        // templates the fresh FREE option is only reachable through PSLIPO rows
        // (settingJson stores paymentOptionId for paid templates only).
        List<PackageSessionLearnerInvitationToPaymentOption> existingMappings =
                pslipoService.findByInvite(template);
        if (existingMappings.isEmpty()) {
            throw new VacademyException("Template has no linked courses");
        }
        PaymentOption option = existingMappings.get(0).getPaymentOption();

        // Diff the course set, keeping every row on the SAME payment option.
        Set<String> wantedIds = new LinkedHashSet<>(request.getPackageSessionIds());
        List<String> removedRowIds = existingMappings.stream()
                .filter(m -> !wantedIds.contains(m.getPackageSession().getId()))
                .map(PackageSessionLearnerInvitationToPaymentOption::getId)
                .toList();
        Set<String> currentIds = existingMappings.stream()
                .map(m -> m.getPackageSession().getId())
                .collect(Collectors.toSet());
        List<PackageSessionLearnerInvitationToPaymentOption> newMappings = new ArrayList<>();
        for (String psId : wantedIds) {
            if (currentIds.contains(psId)) {
                continue;
            }
            PackageSession ps = packageSessionService.findById(psId);
            newMappings.add(new PackageSessionLearnerInvitationToPaymentOption(
                    template, ps, option, StatusEnum.ACTIVE.name()));
        }
        pslipoService.updateStatusByIds(removedRowIds, StatusEnum.DELETED.name());
        pslipoService.createPackageSessionLearnerInvitationToPaymentOptions(newMappings);

        // FREE templates: keep the fresh FREE plan's seat cap/validity in lockstep with
        // settingJson — spawn reads settingJson, admin enrollment reads the plan via PSLIPO.
        if (PaymentOptionType.FREE.name().equals(paymentType) && option != null) {
            for (PaymentPlan plan : option.getPaymentPlans()) {
                if (StatusEnum.ACTIVE.name().equals(plan.getStatus())) {
                    plan.setMemberCount(request.getMemberCount());
                    plan.setValidityInDays(request.getValidityInDays());
                }
            }
            paymentOptionRepository.save(option);
        }

        template.setName(request.getName());
        template.setIsBundled(wantedIds.size() > 1);
        template.setLearnerAccessDays(request.getValidityInDays());
        template.setSettingJson(SubOrgRegistrationSettings.serialize(buildSettings(request, paymentType)));
        enrollInviteRepository.save(template);

        // Unlike create, ALWAYS sync — an empty list must soft-delete leftover fields
        // so the mapping table stays consistent with the recomputed STEPS.
        instituteCustomFiledService.syncFeatureCustomFields(
                instituteId,
                CustomFieldTypeEnum.ENROLL_INVITE.name(),
                template.getId(),
                request.getInstituteCustomFields() == null
                        ? new ArrayList<>()
                        : request.getInstituteCustomFields());

        log.info("Updated SUB_ORG_REGISTRATION template id={} institute={} sessions={} paymentType={}",
                template.getId(), instituteId, wantedIds.size(), paymentType);
        return Map.of(
                "template_id", template.getId(),
                "invite_code", template.getInviteCode());
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
                        .kycStatus(r.getKycStatus())
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
            CreateRegistrationTemplateDTO request, String paymentType) {
        SubOrgRegistrationSettingDTO.RegistrationSetting setting =
                new SubOrgRegistrationSettingDTO.RegistrationSetting();
        List<String> steps = new ArrayList<>();
        steps.add("DETAILS");
        if (!CollectionUtils.isEmpty(request.getInstituteCustomFields())) {
            steps.add("CUSTOM_FIELDS");
        }
        // TNC step: enabled by a PDF, consent statements, or both.
        List<String> consentItems = request.getTncConsentItems() == null ? List.of()
                : request.getTncConsentItems().stream()
                        .filter(StringUtils::hasText)
                        .map(String::trim)
                        .toList();
        if (consentItems.size() > 10) {
            throw new VacademyException("At most 10 consent statements are allowed");
        }
        for (String item : consentItems) {
            if (item.length() > 1000) {
                throw new VacademyException("Consent statements must be at most 1000 characters");
            }
        }
        if (StringUtils.hasText(request.getTncFileId()) || !consentItems.isEmpty()) {
            steps.add("TNC");
            if (StringUtils.hasText(request.getTncFileId())) {
                setting.setTncFileId(request.getTncFileId());
            }
            if (!consentItems.isEmpty()) {
                setting.setTncConsentItems(consentItems);
            }
        }
        // DigiLocker KYC: verify identity before taking payment.
        if (!CollectionUtils.isEmpty(request.getKycDocuments())) {
            List<String> kycDocs = request.getKycDocuments().stream()
                    .map(String::toUpperCase).distinct().toList();
            for (String doc : kycDocs) {
                if (!"AADHAAR".equals(doc) && !"PAN".equals(doc)) {
                    throw new VacademyException("kyc_documents supports only AADHAAR and PAN");
                }
            }
            if (!kycDocs.contains("AADHAAR")) {
                throw new VacademyException("kyc_documents must include AADHAAR");
            }
            steps.add("KYC");
            setting.setKycDocuments(kycDocs);
        }
        boolean isPaid = PaymentOptionType.ONE_TIME.name().equals(paymentType)
                || PaymentOptionType.SUBSCRIPTION.name().equals(paymentType);
        if (isPaid) {
            steps.add("PAYMENT");
            setting.setPaymentType(paymentType);
            setting.setPaymentOptionId(request.getPaymentOptionId());
            setting.setVendor(request.getVendor());
            setting.setVendorId(request.getVendorId());
            setting.setCurrency(request.getCurrency());
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

        // ---- Presentation + completion config (all optional; trimmed). ----
        String orgNameHint = trimToNull(request.getOrgNameHint());
        if (orgNameHint != null && orgNameHint.length() > 300) {
            throw new VacademyException("org_name_hint must be at most 300 characters");
        }
        setting.setOrgNameHint(orgNameHint);
        setting.setCollectAddress(Boolean.TRUE.equals(request.getCollectAddress()) ? true : null);
        String kycInstructions = trimToNull(request.getKycInstructions());
        if (kycInstructions != null && kycInstructions.length() > 1000) {
            throw new VacademyException("kyc_instructions must be at most 1000 characters");
        }
        setting.setKycInstructions(kycInstructions);
        String completionMessage = trimToNull(request.getCompletionMessage());
        if (completionMessage != null && completionMessage.length() > 2000) {
            throw new VacademyException("completion_message must be at most 2000 characters");
        }
        setting.setCompletionMessage(completionMessage);
        String buttonLabel = trimToNull(request.getCompletionButtonLabel());
        String buttonUrl = trimToNull(request.getCompletionButtonUrl());
        if ((buttonLabel == null) != (buttonUrl == null)) {
            throw new VacademyException(
                    "completion_button_label and completion_button_url must be set together");
        }
        if (buttonLabel != null && buttonLabel.length() > 100) {
            throw new VacademyException("completion_button_label must be at most 100 characters");
        }
        if (buttonUrl != null && !buttonUrl.startsWith("https://")) {
            throw new VacademyException("completion_button_url must start with https://");
        }
        setting.setCompletionButtonLabel(buttonLabel);
        setting.setCompletionButtonUrl(buttonUrl);
        String redirectUrl = trimToNull(request.getCompletionRedirectUrl());
        if (redirectUrl != null && !redirectUrl.startsWith("https://")) {
            throw new VacademyException("completion_redirect_url must start with https://");
        }
        setting.setCompletionRedirectUrl(redirectUrl);
        return setting;
    }

    private static String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
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
