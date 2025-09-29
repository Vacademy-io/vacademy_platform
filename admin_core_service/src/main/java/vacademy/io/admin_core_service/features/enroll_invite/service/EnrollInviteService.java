package vacademy.io.admin_core_service.features.enroll_invite.service;

import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldTypeEnum;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.enroll_invite.dto.*;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionEnrollInvitePaymentOptionPlanToReferralOption;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.enums.EnrollInviteTag;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentPlanDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentPlanService;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralOptionService;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class EnrollInviteService {

    @Autowired
    private EnrollInviteRepository repository;
    @Autowired
    private PaymentOptionService paymentOptionService;
    @Autowired
    private PackageSessionEnrollInviteToPaymentOptionService packageSessionEnrollInviteToPaymentOptionService;
    @Autowired
    private PackageSessionService packageSessionService;
    @Autowired
    private InstituteCustomFiledService instituteCustomFiledService;
    @Autowired
    private ReferralOptionService referralOptionService;
    @Autowired
    private PaymentPlanService paymentPlanService;
    @Autowired
    private PackageSessionEnrollInvitePaymentOptionPlanToReferralOptionService packageSessionEnrollInvitePaymentOptionPlanToReferralOptionService;

    @Transactional
    public String createEnrollInvite(EnrollInviteDTO enrollInviteDTO) {
        if (enrollInviteDTO == null) {
            throw new VacademyException("EnrollInvite payload cannot be null.");
        }
        enrollInviteDTO.setInviteCode(getInviteCode());
        List<PackageSessionToPaymentOptionDTO> mappingDTOs = enrollInviteDTO.getPackageSessionToPaymentOptions();
        if (CollectionUtils.isEmpty(mappingDTOs)) {
            throw new VacademyException("Package session to payment options cannot be empty.");
        }

        EnrollInvite enrollInviteToSave = new EnrollInvite(enrollInviteDTO);
        final EnrollInvite savedEnrollInvite = repository.save(enrollInviteToSave);

        if (!CollectionUtils.isEmpty(enrollInviteDTO.getInstituteCustomFields())) {
            List<InstituteCustomFieldDTO> customFieldsToSave = enrollInviteDTO.getInstituteCustomFields().stream()
                    .filter(Objects::nonNull)
                    .peek(cf -> {
                        cf.setType(CustomFieldTypeEnum.ENROLL_INVITE.name());
                        cf.setTypeId(savedEnrollInvite.getId());
                    })
                    .collect(Collectors.toList());
            instituteCustomFiledService.addOrUpdateCustomField(customFieldsToSave);
        }

        List<PackageSessionLearnerInvitationToPaymentOption> mappingEntities = mappingDTOs.stream()
                .filter(Objects::nonNull)
                .map(dto -> {
                    validateMappingDTO(dto);
                    PaymentOption paymentOption = paymentOptionService.findById(dto.getPaymentOption().getId());
                    PackageSession packageSession = packageSessionService.findById(dto.getPackageSessionId());

                    return new PackageSessionLearnerInvitationToPaymentOption(
                            savedEnrollInvite, packageSession, paymentOption, StatusEnum.ACTIVE.name());
                })
                .collect(Collectors.toList());

        if (mappingEntities.isEmpty()) {
            throw new VacademyException("No valid packageSession-paymentOption mappings were provided.");
        }
        packageSessionEnrollInviteToPaymentOptionService
                .createPackageSessionLearnerInvitationToPaymentOptions(mappingEntities);
        validateSaveOrUpdate(mappingEntities, mappingDTOs);
        return savedEnrollInvite.getId();
    }

    @Transactional
    public String updateEnrollInvite(EnrollInviteDTO enrollInviteDTO) {
        if (enrollInviteDTO == null) {
            throw new VacademyException("EnrollInvite payload cannot be null.");
        }
        List<PackageSessionToPaymentOptionDTO> mappingDTOs = enrollInviteDTO.getPackageSessionToPaymentOptions();
        if (CollectionUtils.isEmpty(mappingDTOs)) {
            throw new VacademyException("Package session to payment options cannot be empty.");
        }

        EnrollInvite enrollInviteToSave = findById(enrollInviteDTO.getId());
        updateEnrollInvite(enrollInviteDTO, enrollInviteToSave);
        final EnrollInvite savedEnrollInvite = repository.save(enrollInviteToSave);

        if (!CollectionUtils.isEmpty(enrollInviteDTO.getInstituteCustomFields())) {
            List<InstituteCustomFieldDTO> customFieldsToSave = enrollInviteDTO.getInstituteCustomFields().stream()
                    .filter(Objects::nonNull)
                    .peek(cf -> {
                        cf.setType(CustomFieldTypeEnum.ENROLL_INVITE.name());
                        cf.setTypeId(savedEnrollInvite.getId());
                    })
                    .collect(Collectors.toList());
            instituteCustomFiledService.addOrUpdateCustomField(customFieldsToSave);
        }

        List<PackageSessionLearnerInvitationToPaymentOption> mappingEntities = mappingDTOs.stream()
                .filter(Objects::nonNull)
                .map(dto -> {
                    if (StringUtils.hasText(dto.getId())) {
                        return packageSessionEnrollInviteToPaymentOptionService.updateStatus(dto.getId(),
                                dto.getStatus());
                    } else {
                        validateMappingDTO(dto);
                        PaymentOption paymentOption = paymentOptionService.findById(dto.getPaymentOption().getId());
                        PackageSession packageSession = packageSessionService.findById(dto.getPackageSessionId());

                        return new PackageSessionLearnerInvitationToPaymentOption(
                                savedEnrollInvite, packageSession, paymentOption, StatusEnum.ACTIVE.name());
                    }
                })
                .collect(Collectors.toList());

        if (mappingEntities.isEmpty()) {
            throw new VacademyException("No valid packageSession-paymentOption mappings were provided.");
        }
        packageSessionEnrollInviteToPaymentOptionService
                .createPackageSessionLearnerInvitationToPaymentOptions(mappingEntities);
        validateSaveOrUpdate(mappingEntities, mappingDTOs);
        return savedEnrollInvite.getId();
    }
    // Create and other existing methods...

    private void updateEnrollInvite(EnrollInviteDTO enrollInviteDTO, EnrollInvite enrollInvite) {
        enrollInvite.setCurrency(enrollInviteDTO.getCurrency());
        enrollInvite.setWebPageMetaDataJson(enrollInviteDTO.getWebPageMetaDataJson());
        enrollInvite.setVendor(enrollInviteDTO.getVendor());
        enrollInvite.setEndDate(enrollInviteDTO.getEndDate());
        enrollInvite.setStartDate(enrollInviteDTO.getStartDate());
        enrollInvite.setLearnerAccessDays(enrollInviteDTO.getLearnerAccessDays());
        enrollInvite.setStatus(enrollInviteDTO.getStatus());
        enrollInvite.setName(enrollInviteDTO.getName());
        enrollInvite.setVendorId(enrollInviteDTO.getVendorId());
        enrollInvite.setIsBundled(enrollInviteDTO.getIsBundled());
    }

    public Page<EnrollInviteWithSessionsProjection> getEnrollInvitesByInstituteIdAndFilters(String instituteId,
            EnrollInviteFilterDTO enrollInviteFilterDTO, int pageNo, int pageSize) {
        Sort sortColumns = ListService.createSortObject(enrollInviteFilterDTO.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, sortColumns);
        if (StringUtils.hasText(enrollInviteFilterDTO.getSearchName())) {
            return repository.getEnrollInvitesByInstituteIdAndSearchName(instituteId,
                    enrollInviteFilterDTO.getSearchName(),
                    List.of(StatusEnum.ACTIVE.name()),
                    List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                    pageable);
        } else {
            return repository.getEnrollInvitesWithFilters(instituteId,
                    enrollInviteFilterDTO.getPackageSessionIds(),
                    enrollInviteFilterDTO.getPaymentOptionIds(),
                    enrollInviteFilterDTO.getTags(),
                    List.of(StatusEnum.ACTIVE.name()),
                    List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                    pageable);
        }
    }

    public EnrollInviteDTO findByEnrollInviteId(String enrollInviteId, String instituteId) {
        EnrollInvite enrollInvite = repository.findById(enrollInviteId)
                .orElseThrow(() -> new VacademyException("EnrollInvite not found with id: " + enrollInviteId));
        return buildFullEnrollInviteDTO(enrollInvite, instituteId);
    }

    public EnrollInviteDTO findDefaultEnrollInviteByPackageSessionId(String packageSessionId, String instituteId) {
        EnrollInvite enrollInvite = repository.findLatestForPackageSessionWithFilters(
                packageSessionId,
                List.of(StatusEnum.ACTIVE.name()),
                List.of(EnrollInviteTag.DEFAULT.name()),
                List.of(StatusEnum.ACTIVE.name()))
                .orElseThrow(() -> new VacademyException(
                        "Default EnrollInvite not found for package session: " + packageSessionId));
        return buildFullEnrollInviteDTO(enrollInvite, instituteId);
    }

    public List<EnrollInviteDTO> findByPaymentOptionIds(List<String> paymentOptionIds, String instituteId) {
        List<PackageSessionLearnerInvitationToPaymentOption> mappings = packageSessionEnrollInviteToPaymentOptionService
                .findByPaymentOptionIds(paymentOptionIds);

        Map<EnrollInvite, List<PackageSessionLearnerInvitationToPaymentOption>> groupedByInvite = mappings.stream()
                .collect(Collectors.groupingBy(PackageSessionLearnerInvitationToPaymentOption::getEnrollInvite));

        return groupedByInvite.entrySet().stream()
                .map(entry -> buildFullEnrollInviteDTO(entry.getKey(), instituteId, entry.getValue()))
                .collect(Collectors.toList());
    }

    public List<EnrollInviteDTO> findEnrollInvitesByReferralOptionIds(List<String> referralOptionIds,
            String instituteId) {
        List<PackageSessionEnrollInvitePaymentOptionPlanToReferralOption> referralMappings = packageSessionEnrollInvitePaymentOptionPlanToReferralOptionService
                .findByReferralOptionIds(referralOptionIds);

        Map<EnrollInvite, List<PackageSessionLearnerInvitationToPaymentOption>> groupedByInvite = referralMappings
                .stream()
                .map(PackageSessionEnrollInvitePaymentOptionPlanToReferralOption::getPackageSessionLearnerInvitationToPaymentOption)
                .distinct()
                .collect(Collectors.groupingBy(PackageSessionLearnerInvitationToPaymentOption::getEnrollInvite));

        return groupedByInvite.entrySet().stream()
                .map(entry -> buildFullEnrollInviteDTO(entry.getKey(), instituteId, entry.getValue()))
                .collect(Collectors.toList());
    }

    @Transactional
    public String updateDefaultEnrollInviteConfig(String enrollInviteId, String packageSessionId) {
        removeDefaultTag(packageSessionId);
        addDefaultTag(enrollInviteId);
        return enrollInviteId;
    }

    @Transactional
    public String deleteEnrollInvites(List<String> enrollInviteIds) {
        List<EnrollInvite> enrollInvites = repository.findAllById(enrollInviteIds);
        for (EnrollInvite enrollInvite : enrollInvites) {
            enrollInvite.setStatus(StatusEnum.DELETED.name());
        }
        repository.saveAll(enrollInvites);
        packageSessionEnrollInviteToPaymentOptionService.deleteByEnrollInviteIds(enrollInviteIds);
        return "Enroll invites deleted successfully";
    }

    // ===================================================================================
    // PRIVATE HELPER AND DTO BUILDING METHODS
    // ===================================================================================

    public EnrollInviteDTO buildFullEnrollInviteDTO(EnrollInvite enrollInvite, String instituteId) {
        List<PackageSessionLearnerInvitationToPaymentOption> mappings = packageSessionEnrollInviteToPaymentOptionService
                .findByInvite(enrollInvite);
        return buildFullEnrollInviteDTO(enrollInvite, instituteId, mappings);
    }

    private EnrollInviteDTO buildFullEnrollInviteDTO(EnrollInvite enrollInvite, String instituteId,
            List<PackageSessionLearnerInvitationToPaymentOption> mappings) {
        EnrollInviteDTO dto = enrollInvite.toEnrollInviteDTO();

        // 1. Fetch and set Custom Fields
        dto.setInstituteCustomFields(instituteCustomFiledService.findCustomFieldsAsJson(
                instituteId, CustomFieldTypeEnum.ENROLL_INVITE.name(), enrollInvite.getId()));

        // 2. Build and set Payment Option DTOs from mappings
        List<PackageSessionToPaymentOptionDTO> paymentOptionDTOs = mappings.stream()
                .map(this::mapToPackageSessionToPaymentOptionDTO)
                .collect(Collectors.toList());
        dto.setPackageSessionToPaymentOptions(paymentOptionDTOs);

        return dto;
    }

    private PackageSessionToPaymentOptionDTO mapToPackageSessionToPaymentOptionDTO(
            PackageSessionLearnerInvitationToPaymentOption mapping) {
        if (mapping == null)
            return null;
        PaymentOption paymentOption = mapping.getPaymentOption();
        if (paymentOption == null)
            return null;

        List<PaymentPlanDTO> paymentPlans = mapPaymentPlans(mapping,
                Optional.ofNullable(paymentOption.getPaymentPlans()).orElse(Collections.emptyList()));

        PaymentOptionDTO paymentOptionDTO = mapToPaymentOptionDTO(paymentOption, paymentPlans);

        return PackageSessionToPaymentOptionDTO.builder()
                .id(mapping.getId())
                .packageSessionId(mapping.getPackageSession() != null ? mapping.getPackageSession().getId() : null)
                .enrollInviteId(mapping.getEnrollInvite() != null ? mapping.getEnrollInvite().getId() : null)
                .status(mapping.getStatus())
                .paymentOption(paymentOptionDTO)
                .build();
    }

    private PaymentOptionDTO mapToPaymentOptionDTO(PaymentOption paymentOption, List<PaymentPlanDTO> paymentPlans) {
        return PaymentOptionDTO.builder()
                .id(paymentOption.getId())
                .name(paymentOption.getName())
                .status(paymentOption.getStatus())
                .source(paymentOption.getSource())
                .sourceId(paymentOption.getSourceId())
                .tag(paymentOption.getTag())
                .type(paymentOption.getType())
                .paymentOptionMetadataJson(paymentOption.getPaymentOptionMetadataJson())
                .requireApproval(paymentOption.isRequireApproval())
                .paymentPlans(paymentPlans)
                .build();
    }

    private List<PaymentPlanDTO> mapPaymentPlans(
            PackageSessionLearnerInvitationToPaymentOption mapping, List<PaymentPlan> paymentPlans) {
        return paymentPlans.stream()
                .filter(Objects::nonNull)
                .map(plan -> mapPaymentPlan(plan, mapping))
                .collect(Collectors.toList());
    }

    private PaymentPlanDTO mapPaymentPlan(
            PaymentPlan paymentPlan, PackageSessionLearnerInvitationToPaymentOption mapping) {
        PaymentPlanDTO paymentPlanDTO = paymentPlan.mapToPaymentPlanDTO();
        Optional<ReferralOptionDTO> referralOption = packageSessionEnrollInvitePaymentOptionPlanToReferralOptionService
                .getReferralOptionsByPackageSessionLearnerInvitationToPaymentOptionAndPaymentPlan(mapping, paymentPlan);
        paymentPlanDTO.setReferralOption(referralOption.orElse(null));
        return paymentPlanDTO;
    }

    // Other private methods like removeDefaultTag, addDefaultTag, validate...
    private void removeDefaultTag(String packageSessionId) {
        Optional<EnrollInvite> optionalEnrollInvite = repository.findLatestForPackageSessionWithFilters(
                packageSessionId,
                List.of(StatusEnum.ACTIVE.name()),
                List.of(EnrollInviteTag.DEFAULT.name()),
                List.of(StatusEnum.ACTIVE.name()));
        if (optionalEnrollInvite.isPresent()) {
            EnrollInvite enrollInvite = optionalEnrollInvite.get();
            enrollInvite.setTag(null);
            repository.save(enrollInvite);
        }
    }

    private void addDefaultTag(String enrollInviteId) {
        Optional<EnrollInvite> optionalEnrollInvite = repository.findById(enrollInviteId);
        if (optionalEnrollInvite.isPresent()) {
            EnrollInvite enrollInvite = optionalEnrollInvite.get();
            enrollInvite.setTag(EnrollInviteTag.DEFAULT.name());
            repository.save(enrollInvite);
        } else {
            throw new VacademyException("EnrollInvite not found");
        }
    }

    private void validateMappingDTO(PackageSessionToPaymentOptionDTO dto) {
        if (dto.getPackageSessionId() == null || dto.getPackageSessionId().isBlank()) {
            throw new VacademyException("packageSessionId is required in packageSessionToPaymentOptions.");
        }
        if (dto.getPaymentOption() == null || dto.getPaymentOption().getId() == null
                || dto.getPaymentOption().getId().isBlank()) {
            throw new VacademyException("paymentOption.id is required in packageSessionToPaymentOptions.");
        }
    }

    private void validateSaveOrUpdate(
            List<PackageSessionLearnerInvitationToPaymentOption> savedMappings,
            List<PackageSessionToPaymentOptionDTO> originalDTOs) {

        if (CollectionUtils.isEmpty(savedMappings) || CollectionUtils.isEmpty(originalDTOs)
                || savedMappings.size() != originalDTOs.size()) {
            return;
        }

        List<PackageSessionEnrollInvitePaymentOptionPlanToReferralOption> referralsToSave = new ArrayList<>();

        for (int i = 0; i < originalDTOs.size(); i++) {
            PackageSessionToPaymentOptionDTO dto = originalDTOs.get(i);
            PackageSessionLearnerInvitationToPaymentOption persistedParent = savedMappings.get(i);

            if (Objects.isNull(dto.getPaymentOption())
                    || CollectionUtils.isEmpty(dto.getPaymentOption().getPaymentPlans())) {
                continue;
            }

            for (PaymentPlanDTO planDTO : dto.getPaymentOption().getPaymentPlans()) {
                if (Objects.nonNull(planDTO.getReferralOption())
                        && StringUtils.hasText(planDTO.getReferralOption().getId())) {
                    Optional<PaymentPlan> optionalPlan = paymentPlanService.findById(planDTO.getId());
                    Optional<ReferralOption> optionalReferral = referralOptionService
                            .getReferralOption(planDTO.getReferralOption().getId());

                    if (optionalPlan.isPresent() && optionalReferral.isPresent()) {
                        PackageSessionEnrollInvitePaymentOptionPlanToReferralOption childEntity = packageSessionEnrollInvitePaymentOptionPlanToReferralOptionService
                                .addOrUpdatePackageSessionEnrollInvitePaymentOptionPlanToReferralOption(persistedParent,
                                        optionalReferral.get(), optionalPlan.get(),
                                        planDTO.getReferralOptionSMappingStatus());
                        referralsToSave.add(childEntity);
                    }
                }
            }
        }

        if (!referralsToSave.isEmpty()) {
            packageSessionEnrollInvitePaymentOptionPlanToReferralOptionService.saveInBulk(referralsToSave);
        }
    }

    @Transactional
    public String updatePaymentOptionsForInvites(
            List<UpdateEnrollInvitePackageSessionPaymentOptionDTO> updatePaymentOptionRequests) {

        // Step 1: Delete old payment options
        List<String> oldPaymentOptionIds = extractOldPaymentOptionIds(updatePaymentOptionRequests);
        deleteOldPaymentOptions(oldPaymentOptionIds);

        // Step 2: Process new payment options for each enroll invite
        for (UpdateEnrollInvitePackageSessionPaymentOptionDTO request : updatePaymentOptionRequests) {
            processNewPaymentOptions(request);
        }

        return "success";
    }

    // ------------------- PRIVATE METHODS ------------------- //

    /**
     * Extracts old payment option IDs that need to be deleted.
     */
    private List<String> extractOldPaymentOptionIds(
            List<UpdateEnrollInvitePackageSessionPaymentOptionDTO> requests) {
        List<String> oldIds = new ArrayList<>();
        for (UpdateEnrollInvitePackageSessionPaymentOptionDTO dto : requests) {
            if (dto.getUpdatePaymentOptions() != null) {
                dto.getUpdatePaymentOptions().forEach(updateOption -> {
                    if (updateOption.getOldPackageSessionPaymentOptionId() != null) {
                        oldIds.add(updateOption.getOldPackageSessionPaymentOptionId());
                    }
                });
            }
        }
        return oldIds;
    }

    /**
     * Deletes old payment options and related referral options by setting them to
     * DELETED.
     */
    private void deleteOldPaymentOptions(List<String> oldIds) {
        if (oldIds.isEmpty())
            return;
        packageSessionEnrollInviteToPaymentOptionService.updateStatusByIds(oldIds, StatusEnum.DELETED.name());
        packageSessionEnrollInvitePaymentOptionPlanToReferralOptionService
                .updateStatusByPackageSessionLearnerInvitationToPaymentOptionIds(oldIds, StatusEnum.DELETED.name());
    }

    /**
     * Processes new payment options for a single enroll invite request.
     */
    private void processNewPaymentOptions(UpdateEnrollInvitePackageSessionPaymentOptionDTO request) {
        if (request.getUpdatePaymentOptions() == null)
            return;

        Optional<EnrollInvite> optionalEnrollInvite = repository.findById(request.getEnrollInviteId());
        if (optionalEnrollInvite.isEmpty())
            return;

        EnrollInvite enrollInvite = optionalEnrollInvite.get();

        // Create new PackageSessionLearnerInvitationToPaymentOption entities
        List<PackageSessionLearnerInvitationToPaymentOption> newPaymentOptions = request.getUpdatePaymentOptions()
                .stream()
                .map(updateOption -> createPackageSessionPaymentOption(enrollInvite, updateOption))
                .collect(Collectors.toList());

        List<PackageSessionToPaymentOptionDTO> newPaymentOptionDTOs = request.getUpdatePaymentOptions()
                .stream()
                .map(UpdateEnrollInvitePackageSessionPaymentOptionDTO.UpdatePaymentOptionDTO::getNewPackageSessionPaymentOption)
                .collect(Collectors.toList());

        // Save new payment options and referral options
        packageSessionEnrollInviteToPaymentOptionService
                .createPackageSessionLearnerInvitationToPaymentOptions(newPaymentOptions);
        validateSaveOrUpdate(newPaymentOptions, newPaymentOptionDTOs);
    }

    /**
     * Creates a single PackageSessionLearnerInvitationToPaymentOption from the
     * provided DTO.
     */
    private PackageSessionLearnerInvitationToPaymentOption createPackageSessionPaymentOption(
            EnrollInvite enrollInvite,
            UpdateEnrollInvitePackageSessionPaymentOptionDTO.UpdatePaymentOptionDTO updateOptionDTO) {

        PackageSession packageSession = packageSessionService
                .findById(updateOptionDTO.getNewPackageSessionPaymentOption().getPackageSessionId());

        PaymentOption paymentOption = paymentOptionService
                .findById(updateOptionDTO.getNewPackageSessionPaymentOption().getPaymentOption().getId());

        return new PackageSessionLearnerInvitationToPaymentOption(
                enrollInvite,
                packageSession,
                paymentOption,
                StatusEnum.ACTIVE.name());
    }

    public EnrollInvite findById(String id) {
        return repository.findById(id).orElseThrow(() -> new VacademyException("EnrollInvite not found"));
    }

    private static String getInviteCode() {
        String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(6);

        for (int i = 0; i < 6; i++) {
            int index = random.nextInt(chars.length());
            sb.append(chars.charAt(index));
        }

        return sb.toString();
    }

    /**
     * Retrieves enroll invites by user ID and institute ID following the path:
     * SSIGM -> UserPlan -> EnrollInvite -> PackageSession -> PaymentOption
     * All entities must have ACTIVE status.
     */
    public List<EnrollInviteDTO> getEnrollInvitesByUserIdAndInstituteId(String userId, String instituteId) {

        // Define active statuses for all entities
        List<String> activeStatuses = List.of(StatusEnum.ACTIVE.name());

        // Get enroll invites using the complex join query
        List<EnrollInvite> enrollInvites = repository.findEnrollInvitesByUserIdAndInstituteIdWithActiveStatuses(
            userId,
            instituteId,
            activeStatuses, // SSIGM statuses
            activeStatuses, // UserPlan statuses
            activeStatuses, // EnrollInvite statuses
            activeStatuses, // PackageSessionMapping statuses
            activeStatuses  // PaymentOption statuses
        );


        // Convert to DTOs and populate additional data
        return enrollInvites.stream()
            .map(this::convertToEnrollInviteDTO)
            .collect(Collectors.toList());
    }

    /**
     * Converts EnrollInvite entity to DTO with all related data
     */
    private EnrollInviteDTO convertToEnrollInviteDTO(EnrollInvite enrollInvite) {
        EnrollInviteDTO dto = enrollInvite.toEnrollInviteDTO();
        return dto;
    }
}
