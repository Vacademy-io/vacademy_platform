package vacademy.io.admin_core_service.features.suborg.registration.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldTypeEnum;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldValueSourceTypeEnum;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.enums.EnrollInviteTag;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.enroll_invite.service.PackageSessionEnrollInviteToPaymentOptionService;
import vacademy.io.admin_core_service.features.learner.service.LearnerEnrollRequestService;
import vacademy.io.admin_core_service.features.suborg.dto.CreateSubOrgSubscriptionDTO;
import vacademy.io.admin_core_service.features.suborg.dto.CreateSubOrgSubscriptionResponseDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.CompleteRegistrationRequestDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.CompleteRegistrationResponseDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.PublicPaymentDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.PublicPaymentPlanDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.PublicTemplateDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.StartRegistrationRequestDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.StartRegistrationResponseDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationSettingDTO;
import vacademy.io.admin_core_service.features.suborg.registration.entity.SubOrgRegistration;
import vacademy.io.admin_core_service.features.suborg.registration.enums.SubOrgKycStatus;
import vacademy.io.admin_core_service.features.suborg.registration.enums.SubOrgRegistrationStatus;
import vacademy.io.admin_core_service.features.suborg.registration.repository.SubOrgRegistrationRepository;
import vacademy.io.admin_core_service.features.suborg.service.SubOrgSubscriptionService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollRequestDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.InstituteInfoDTO;
import vacademy.io.common.notification.dto.EmailOTPRequest;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Public (open-endpoint) flow for sub-org self-registration:
 * getTemplate -> start (DRAFT + OTP mail) -> verifyOtp (server-enforced) -> complete (spawn).
 *
 * OTP is enforced HERE, server-side: /complete refuses anything not OTP_VERIFIED. The
 * downstream enroll machinery (recordLearnerRequest) performs no OTP checks of its own.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubOrgRegistrationService {

    private static final String SEND_OTP_ROUTE = "/notification-service/internal/v1/send-email-otp";
    private static final String VERIFY_OTP_ROUTE = "/notification-service/internal/v1/verify-email-otp";
    private static final String OTP_SERVICE_NAME = "sub-org-registration";

    private final SubOrgRegistrationRepository registrationRepository;
    private final PaymentOptionRepository paymentOptionRepository;
    private final EnrollInviteRepository enrollInviteRepository;
    private final PackageSessionEnrollInviteToPaymentOptionService pslipoService;
    private final SubOrgSubscriptionService subOrgSubscriptionService;
    private final LearnerEnrollRequestService learnerEnrollRequestService;
    private final InstituteCustomFiledService instituteCustomFiledService;
    private final CustomFieldValuesRepository customFieldValuesRepository;
    private final InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String applicationName;

    @Value("${notification.server.baseurl}")
    private String notificationServerBaseUrl;

    public PublicTemplateDTO getTemplate(String instituteId, String code) {
        EnrollInvite template = requireOpenTemplate(instituteId, code);
        SubOrgRegistrationSettingDTO.RegistrationSetting setting =
                SubOrgRegistrationSettings.parse(template.getSettingJson());
        return PublicTemplateDTO.builder()
                .templateName(template.getName())
                .instituteId(template.getInstituteId())
                .steps(setting != null && !CollectionUtils.isEmpty(setting.getSteps())
                        ? setting.getSteps() : List.of("DETAILS"))
                .tncFileId(setting != null ? setting.getTncFileId() : null)
                .customFields(instituteCustomFiledService.findCustomFieldsAsJson(
                        template.getInstituteId(),
                        CustomFieldTypeEnum.ENROLL_INVITE.name(),
                        template.getId()))
                .payment(buildPublicPayment(setting))
                .kycDocuments(setting != null && !CollectionUtils.isEmpty(setting.getKycDocuments())
                        ? setting.getKycDocuments() : null)
                .build();
    }

    /** Payment block for the wizard's PAYMENT step; null for FREE templates. */
    private PublicPaymentDTO buildPublicPayment(
            SubOrgRegistrationSettingDTO.RegistrationSetting setting) {
        if (setting == null || !isPaidType(setting.getPaymentType())) return null;
        PaymentOption option = paymentOptionRepository
                .findById(setting.getPaymentOptionId()).orElse(null);
        if (option == null) return null;
        List<PublicPaymentPlanDTO> plans = option.getPaymentPlans().stream()
                .filter(p -> StatusEnum.ACTIVE.name().equals(p.getStatus()))
                .map(p -> PublicPaymentPlanDTO.builder()
                        .id(p.getId())
                        .name(p.getName())
                        .actualPrice(p.getActualPrice())
                        .elevatedPrice(p.getElevatedPrice())
                        .currency(p.getCurrency())
                        .validityInDays(p.getValidityInDays())
                        .description(p.getDescription())
                        .build())
                .toList();
        return PublicPaymentDTO.builder()
                .type(setting.getPaymentType())
                .vendor(setting.getVendor())
                .currency(setting.getCurrency())
                .paymentPlans(plans)
                .build();
    }

    private boolean isPaidType(String paymentType) {
        return PaymentOptionType.ONE_TIME.name().equals(paymentType)
                || PaymentOptionType.SUBSCRIPTION.name().equals(paymentType);
    }

    @Transactional
    public StartRegistrationResponseDTO start(StartRegistrationRequestDTO request) {
        if (!StringUtils.hasText(request.getOrgName())) {
            throw new VacademyException("Organization name is required");
        }
        if (!StringUtils.hasText(request.getAdminName())
                || !StringUtils.hasText(request.getAdminEmail())) {
            throw new VacademyException("Admin name and email are required");
        }
        EnrollInvite template = requireOpenTemplate(request.getInstituteId(), request.getCode());

        String email = request.getAdminEmail().trim().toLowerCase();
        // One live registration per (template, email): verified-but-unfinished or completed
        // attempts block re-registration; unverified DRAFTs don't (typos, abandoned forms).
        boolean duplicate = registrationRepository
                .existsByTemplateInviteIdAndAdminEmailIgnoreCaseAndStatusIn(
                        template.getId(), email,
                        List.of(SubOrgRegistrationStatus.OTP_VERIFIED.name(),
                                SubOrgRegistrationStatus.PENDING_PAYMENT.name(),
                                SubOrgRegistrationStatus.COMPLETED.name()));
        if (duplicate) {
            throw new VacademyException(
                    "A registration with this email already exists for this link");
        }

        SubOrgRegistration registration = new SubOrgRegistration();
        registration.setTemplateInviteId(template.getId());
        registration.setInstituteId(template.getInstituteId());
        registration.setStatus(SubOrgRegistrationStatus.DRAFT.name());
        registration.setOrgName(request.getOrgName().trim());
        registration.setOrgLogoFileId(request.getOrgLogoFileId());
        registration.setAdminName(request.getAdminName().trim());
        registration.setAdminEmail(email);
        registration.setAdminPhone(request.getAdminPhone());
        registration = registrationRepository.save(registration);

        sendOtp(registration);
        return StartRegistrationResponseDTO.builder()
                .registrationId(registration.getId())
                .status(registration.getStatus())
                .build();
    }

    @Transactional
    public StartRegistrationResponseDTO verifyOtp(String registrationId, String otp) {
        if (!StringUtils.hasText(otp)) {
            throw new VacademyException("OTP is required");
        }
        SubOrgRegistration registration = requireRegistration(registrationId);
        if (SubOrgRegistrationStatus.COMPLETED.name().equals(registration.getStatus())) {
            throw new VacademyException("Registration is already completed");
        }
        if (SubOrgRegistrationStatus.OTP_VERIFIED.name().equals(registration.getStatus())) {
            return StartRegistrationResponseDTO.builder()
                    .registrationId(registration.getId())
                    .status(registration.getStatus())
                    .build();
        }

        EmailOTPRequest verifyRequest = EmailOTPRequest.builder()
                .to(registration.getAdminEmail())
                .otp(otp.trim())
                .build();
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                applicationName, HttpMethod.POST.name(), notificationServerBaseUrl,
                VERIFY_OTP_ROUTE, verifyRequest);
        boolean verified = response != null && Boolean.parseBoolean(response.getBody());
        if (!verified) {
            throw new VacademyException("Invalid or expired OTP");
        }

        registration.setStatus(SubOrgRegistrationStatus.OTP_VERIFIED.name());
        registration.setOtpVerifiedAt(new Timestamp(System.currentTimeMillis()));
        registrationRepository.save(registration);
        return StartRegistrationResponseDTO.builder()
                .registrationId(registration.getId())
                .status(registration.getStatus())
                .build();
    }

    public void resendOtp(String registrationId) {
        SubOrgRegistration registration = requireRegistration(registrationId);
        if (SubOrgRegistrationStatus.COMPLETED.name().equals(registration.getStatus())) {
            throw new VacademyException("Registration is already completed");
        }
        sendOtp(registration);
    }

    /**
     * Spawns the sub-org + ROOT_ADMIN through the standard machinery, atomically with the
     * COMPLETED transition. Pessimistic lock + status check make double-submits idempotent.
     */
    @Transactional
    public CompleteRegistrationResponseDTO complete(CompleteRegistrationRequestDTO request) {
        if (!StringUtils.hasText(request.getRegistrationId())) {
            throw new VacademyException("registration_id is required");
        }
        SubOrgRegistration registration = registrationRepository
                .findWithLockById(request.getRegistrationId())
                .orElseThrow(() -> new VacademyException(
                        "Registration not found: " + request.getRegistrationId()));

        if (SubOrgRegistrationStatus.COMPLETED.name().equals(registration.getStatus())) {
            return buildCompleteResponse(registration); // idempotent replay
        }
        if (SubOrgRegistrationStatus.PENDING_PAYMENT.name().equals(registration.getStatus())) {
            // No respawn / no re-initiation (P1b adds retry). Webhook will flip to COMPLETED.
            throw new VacademyException(
                    "Payment is already in progress for this registration. "
                            + "If you completed payment, you will receive your credentials by email shortly.");
        }
        if (!SubOrgRegistrationStatus.OTP_VERIFIED.name().equals(registration.getStatus())) {
            // Server-side OTP enforcement: DRAFT (or FAILED) can never spawn.
            throw new VacademyException("Email verification is required before completing registration");
        }

        EnrollInvite template = enrollInviteRepository.findById(registration.getTemplateInviteId())
                .orElseThrow(() -> new VacademyException("Registration template no longer exists"));
        validateTemplateOpen(template);
        SubOrgRegistrationSettingDTO.RegistrationSetting setting =
                SubOrgRegistrationSettings.parse(template.getSettingJson());

        boolean tncRequired = setting != null && !CollectionUtils.isEmpty(setting.getSteps())
                && setting.getSteps().contains("TNC");
        if (tncRequired) {
            if (!Boolean.TRUE.equals(request.getTncAccepted())) {
                throw new VacademyException("Terms & Conditions must be accepted");
            }
            registration.setTncAcceptedAt(new Timestamp(System.currentTimeMillis()));
        }

        // Server-side KYC enforcement (like OTP): a KYC-gated template can never spawn
        // without a VERIFIED DigiLocker verification on this registration.
        boolean kycRequired = setting != null && !CollectionUtils.isEmpty(setting.getSteps())
                && setting.getSteps().contains("KYC");
        if (kycRequired && !SubOrgKycStatus.VERIFIED.name().equals(registration.getKycStatus())) {
            throw new VacademyException(
                    "Identity verification must be completed before finishing registration");
        }

        // 1. Spawn a standard sub-org (child institute + org-level SUB_ORG invite + PSLIPO
        //    + SUBORG_LEARNER mirrors) with the template's fixed config.
        List<String> packageSessionIds = pslipoService.findByInvite(template).stream()
                .map(PackageSessionLearnerInvitationToPaymentOption::getPackageSession)
                .filter(Objects::nonNull)
                .map(ps -> ps.getId())
                .distinct()
                .toList();
        if (packageSessionIds.isEmpty()) {
            throw new VacademyException("Registration template has no linked courses");
        }

        InstituteInfoDTO subOrgDetails = new InstituteInfoDTO();
        subOrgDetails.setInstituteName(registration.getOrgName());
        subOrgDetails.setInstituteLogoFileId(registration.getOrgLogoFileId());

        boolean isPaid = setting != null && isPaidType(setting.getPaymentType());
        if (isPaid && request.getPaymentInitiationRequest() == null) {
            throw new VacademyException("payment_initiation_request is required for this registration");
        }

        CreateSubOrgSubscriptionDTO spawnRequest = new CreateSubOrgSubscriptionDTO();
        spawnRequest.setSubOrgDetails(subOrgDetails);
        spawnRequest.setPackageSessionIds(packageSessionIds);
        if (isPaid) {
            // Reuse the template's institute PaymentOption on the spawned org invite —
            // createSubOrgWithSubscription's existing paymentOptionId path handles validation,
            // and stamps vendor/vendorId/currency onto the invite (PaymentService reads them).
            spawnRequest.setPaymentType(setting.getPaymentType());
            spawnRequest.setPaymentOptionId(setting.getPaymentOptionId());
            spawnRequest.setVendor(setting.getVendor());
            spawnRequest.setVendorId(setting.getVendorId());
            spawnRequest.setCurrency(setting.getCurrency());
        } else {
            spawnRequest.setPaymentType("FREE");
        }
        spawnRequest.setMemberCount(setting != null ? setting.getMemberCount() : null);
        spawnRequest.setValidityInDays(setting != null ? setting.getValidityDays() : null);
        spawnRequest.setAuthRoles(setting != null && !CollectionUtils.isEmpty(setting.getAuthRoles())
                ? setting.getAuthRoles() : List.of("ADMIN"));
        spawnRequest.setAdminPermissions(setting != null ? setting.getAdminPermissions() : null);
        spawnRequest.setAllowedTeamRoles(setting != null ? setting.getAllowedTeamRoles() : null);
        CreateSubOrgSubscriptionResponseDTO spawned =
                subOrgSubscriptionService.createSubOrgWithSubscription(
                        spawnRequest, template.getInstituteId());
        log.info("Registration {} spawned sub-org {} via template {}",
                registration.getId(), spawned.getSubOrgId(), template.getId());

        // 2. Enroll the admin through the standard path (fetch-or-create user, FREE plan
        //    ACTIVE, ROOT_ADMIN SSIGM+FSPSSM per PS, scoped invites, credential email).
        LearnerEnrollResponseDTO enrollResponse =
                enrollAdminIntoSpawnedSubOrg(registration, spawned, packageSessionIds, request);

        // 3. Persist submitted custom-field values against the registration itself so the
        //    institute can see what the org filled in (values also flow to the USER via
        //    the enroll DTO above).
        saveRegistrationCustomFieldValues(registration, template, request.getCustomFieldValues());

        registration.setSpawnedSubOrgId(spawned.getSubOrgId());
        registration.setSpawnedInviteId(spawned.getEnrollInviteId());
        if (enrollResponse != null && enrollResponse.getUser() != null) {
            registration.setSpawnedUserId(enrollResponse.getUser().getId());
        }
        // Paid: UserPlan is PENDING_FOR_PAYMENT; the payment webhook (UserPlanService
        // applyOperationsOnFirstPayment SUB_ORG branch) flips this row to COMPLETED.
        registration.setStatus(isPaid
                ? SubOrgRegistrationStatus.PENDING_PAYMENT.name()
                : SubOrgRegistrationStatus.COMPLETED.name());
        registrationRepository.save(registration);

        CompleteRegistrationResponseDTO response = buildCompleteResponse(registration);
        if (isPaid && enrollResponse != null) {
            response.setUserPlanId(enrollResponse.getUserPlanId());
            response.setPaymentResponse(enrollResponse.getPaymentResponse());
        }
        return response;
    }

    private LearnerEnrollResponseDTO enrollAdminIntoSpawnedSubOrg(
            SubOrgRegistration registration,
            CreateSubOrgSubscriptionResponseDTO spawned,
            List<String> packageSessionIds,
            CompleteRegistrationRequestDTO request) {
        EnrollInvite spawnedInvite = enrollInviteRepository.findById(spawned.getEnrollInviteId())
                .orElseThrow(() -> new VacademyException("Spawned org invite not found"));
        List<PackageSessionLearnerInvitationToPaymentOption> mappings =
                pslipoService.findByInvite(spawnedInvite);
        if (CollectionUtils.isEmpty(mappings)) {
            throw new VacademyException("Spawned org invite has no payment mapping");
        }
        PaymentOption option = mappings.get(0).getPaymentOption();
        // Paid: honor the plan the org picked in the wizard (must belong to this option);
        // otherwise (or for FREE) fall back to the first ACTIVE plan.
        PaymentPlan plan = null;
        if (StringUtils.hasText(request.getPlanId())) {
            plan = option.getPaymentPlans().stream()
                    .filter(p -> request.getPlanId().equals(p.getId()))
                    .findFirst()
                    .orElseThrow(() -> new VacademyException(
                            "Selected plan does not belong to this registration's payment option"));
        }
        if (plan == null) {
            plan = option.getPaymentPlans().stream()
                    .filter(p -> StatusEnum.ACTIVE.name().equals(p.getStatus()))
                    .findFirst()
                    .orElse(null);
        }

        UserDTO user = new UserDTO();
        user.setFullName(registration.getAdminName());
        user.setEmail(registration.getAdminEmail());
        user.setMobileNumber(registration.getAdminPhone());

        LearnerPackageSessionsEnrollDTO enrollDTO = new LearnerPackageSessionsEnrollDTO();
        enrollDTO.setPackageSessionIds(packageSessionIds);
        enrollDTO.setEnrollInviteId(spawnedInvite.getId());
        enrollDTO.setPaymentOptionId(option.getId());
        enrollDTO.setPlanId(plan != null ? plan.getId() : null);
        enrollDTO.setCustomFieldValues(request.getCustomFieldValues());
        // Paid: the ONE_TIME/SUBSCRIPTION strategy REQUIRES this (throws when null) and uses
        // it to initiate the gateway order; amount is set server-side from the plan.
        enrollDTO.setPaymentInitiationRequest(request.getPaymentInitiationRequest());

        LearnerEnrollRequestDTO learnerEnrollRequestDTO = new LearnerEnrollRequestDTO();
        learnerEnrollRequestDTO.setUser(user);
        learnerEnrollRequestDTO.setInstituteId(registration.getInstituteId());
        learnerEnrollRequestDTO.setLearnerPackageSessionEnroll(enrollDTO);
        return learnerEnrollRequestService.recordLearnerRequest(learnerEnrollRequestDTO);
    }

    private void saveRegistrationCustomFieldValues(
            SubOrgRegistration registration, EnrollInvite template,
            List<CustomFieldValueDTO> values) {
        if (CollectionUtils.isEmpty(values)) return;
        List<CustomFieldValues> rows = new ArrayList<>();
        for (CustomFieldValueDTO value : values) {
            if (value == null || !StringUtils.hasText(value.getCustomFieldId())) continue;
            CustomFieldValues row = new CustomFieldValues();
            row.setCustomFieldId(value.getCustomFieldId());
            row.setSourceType(CustomFieldValueSourceTypeEnum.SUB_ORG_REGISTRATION.name());
            row.setSourceId(registration.getId());
            row.setType(CustomFieldTypeEnum.ENROLL_INVITE.name());
            row.setTypeId(template.getId());
            row.setValue(value.getValue());
            rows.add(row);
        }
        if (!rows.isEmpty()) customFieldValuesRepository.saveAll(rows);
    }

    private void sendOtp(SubOrgRegistration registration) {
        EmailOTPRequest otpRequest = EmailOTPRequest.builder()
                .to(registration.getAdminEmail())
                .subject("Verify your email to continue registration")
                .service(OTP_SERVICE_NAME)
                .name(registration.getAdminName())
                .build();
        String route = SEND_OTP_ROUTE + "?instituteId=" + registration.getInstituteId();
        try {
            internalClientUtils.makeHmacRequest(
                    applicationName, HttpMethod.POST.name(), notificationServerBaseUrl,
                    route, otpRequest);
        } catch (Exception e) {
            log.error("Failed to send registration OTP to {}: {}",
                    registration.getAdminEmail(), e.getMessage());
            throw new VacademyException("Could not send verification email. Please try again.");
        }
    }

    private SubOrgRegistration requireRegistration(String registrationId) {
        if (!StringUtils.hasText(registrationId)) {
            throw new VacademyException("registration_id is required");
        }
        return registrationRepository.findById(registrationId)
                .orElseThrow(() -> new VacademyException(
                        "Registration not found: " + registrationId));
    }

    private EnrollInvite requireOpenTemplate(String instituteId, String code) {
        if (!StringUtils.hasText(instituteId) || !StringUtils.hasText(code)) {
            throw new VacademyException("instituteId and code are required");
        }
        EnrollInvite template = enrollInviteRepository
                .findValidEnrollInvite(List.of(StatusEnum.ACTIVE.name()), instituteId, code)
                .orElseThrow(() -> new VacademyException("Registration link not found or inactive"));
        validateTemplateOpen(template);
        return template;
    }

    private void validateTemplateOpen(EnrollInvite template) {
        if (!EnrollInviteTag.SUB_ORG_REGISTRATION.name().equals(template.getTag())) {
            throw new VacademyException("Registration link not found or inactive");
        }
        if (!StatusEnum.ACTIVE.name().equals(template.getStatus())) {
            throw new VacademyException("This registration link is closed");
        }
        SubOrgRegistrationSettingDTO.RegistrationSetting setting =
                SubOrgRegistrationSettings.parse(template.getSettingJson());
        if (setting != null && setting.getMaxRegistrations() != null) {
            long completed = registrationRepository.countByTemplateInviteIdAndStatus(
                    template.getId(), SubOrgRegistrationStatus.COMPLETED.name());
            if (completed >= setting.getMaxRegistrations()) {
                throw new VacademyException("This registration link has reached its limit");
            }
        }
    }

    private CompleteRegistrationResponseDTO buildCompleteResponse(SubOrgRegistration registration) {
        return CompleteRegistrationResponseDTO.builder()
                .registrationId(registration.getId())
                .status(registration.getStatus())
                .subOrgId(registration.getSpawnedSubOrgId())
                .adminEmail(registration.getAdminEmail())
                .build();
    }
}
