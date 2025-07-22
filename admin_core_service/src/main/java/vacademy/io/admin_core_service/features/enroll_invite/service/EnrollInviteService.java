package vacademy.io.admin_core_service.features.enroll_invite.service;

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
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteFilterDTO;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteWithSessionsProjection;
import vacademy.io.admin_core_service.features.enroll_invite.dto.PackageSessionToPaymentOptionDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionEnrollInvitePaymentOptionPlanToReferralOption;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.enums.EnrollInviteTag;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentPlanDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentPlanService;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralOptionService;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class EnrollInviteService {

    @Autowired private EnrollInviteRepository repository;
    @Autowired private PaymentOptionService paymentOptionService;
    @Autowired private PackageSessionEnrollInviteToPaymentOptionService packageSessionEnrollInviteToPaymentOptionService;
    @Autowired private PackageSessionService packageSessionService;
    @Autowired private InstituteCustomFiledService instituteCustomFiledService;
    @Autowired private ReferralOptionService referralOptionService;
    @Autowired private PaymentPlanService paymentPlanService;
    @Autowired private PackageSessionEnrollInvitePaymentOptionPlanToReferralOptionService packageSessionEnrollInvitePaymentOptionPlanToReferralOptionService;
    /**
     * Creates an EnrollInvite along with its associated custom fields and package-to-payment mappings.
     *
     * <p>Validation Rules:
     * <ul>
     * <li>enrollInviteDTO must not be null.</li>
     * <li>packageSessionToPaymentOptions must not be null or empty.</li>
     * <li>Each mapping must contain a non-null paymentOption.id and packageSessionId.</li>
     * <li>All referenced PaymentOption and PackageSession entities must exist in the database.</li>
     * </ul>
     *
     * @param enrollInviteDTO The data transfer object containing the enroll invite details.
     * @return The ID of the newly persisted EnrollInvite.
     * @throws VacademyException if validation fails.
     */
    @Transactional
    public String createEnrollInvite(EnrollInviteDTO enrollInviteDTO) {
        // 1. Validate initial payload
        if (enrollInviteDTO == null) {
            throw new VacademyException("EnrollInvite payload cannot be null.");
        }
        List<PackageSessionToPaymentOptionDTO> mappingDTOs = enrollInviteDTO.getPackageSessionToPaymentOptions();
        if (CollectionUtils.isEmpty(mappingDTOs)) {
            throw new VacademyException("Package session to payment options cannot be empty.");
        }

        // 2. Persist the core EnrollInvite entity
        EnrollInvite enrollInviteToSave = new EnrollInvite(enrollInviteDTO);
        final EnrollInvite savedEnrollInvite = repository.save(enrollInviteToSave);

        // 3. Attach and persist custom fields, if any
        if (!CollectionUtils.isEmpty(enrollInviteDTO.getInstituteCustomFields())) {
            List<InstituteCustomFieldDTO> customFieldsToSave = enrollInviteDTO.getInstituteCustomFields().stream()
                    .filter(Objects::nonNull)
                    .peek(cf -> {
                        cf.setType(CustomFieldTypeEnum.ENROLL_INVITE.name());
                        cf.setTypeId(savedEnrollInvite.getId());
                    })
                    .collect(Collectors.toList());
            instituteCustomFiledService.addCustomFields(customFieldsToSave);
        }

        // 4. Build and persist the mapping entities between PackageSession and PaymentOption
        List<PackageSessionLearnerInvitationToPaymentOption> mappingEntities = mappingDTOs.stream()
                .filter(Objects::nonNull)
                .map(dto -> {
                    validateMappingDTO(dto);
                    PaymentOption paymentOption = paymentOptionService.findById(dto.getPaymentOption().getId());
                    PackageSession packageSession = packageSessionService.findById(dto.getPackageSessionId());

                    PackageSessionLearnerInvitationToPaymentOption packageSessionLearnerInvitationToPaymentOption = new PackageSessionLearnerInvitationToPaymentOption(
                            savedEnrollInvite,
                            packageSession,
                            paymentOption,
                            StatusEnum.ACTIVE.name()
                    );
                    return packageSessionLearnerInvitationToPaymentOption;
                })
                .collect(Collectors.toList());

        if (mappingEntities.isEmpty()) {
            // This case would only be hit if the original list contained only null elements
            throw new VacademyException("No valid packageSession-paymentOption mappings were provided.");
        }
        packageSessionEnrollInviteToPaymentOptionService.createPackageSessionLearnerInvitationToPaymentOptions(mappingEntities);
        validateAndSaveReferralOption(mappingEntities, mappingDTOs);
        return savedEnrollInvite.getId();
    }

    private void validateAndSaveReferralOption(
            List<PackageSessionLearnerInvitationToPaymentOption> savedMappings,
            List<PackageSessionToPaymentOptionDTO> originalDTOs) {

        // Ensure the lists are workable and have the same size.
        if (CollectionUtils.isEmpty(savedMappings) || CollectionUtils.isEmpty(originalDTOs) || savedMappings.size() != originalDTOs.size()) {
            // Or throw an exception, as this indicates a programming error.
            return;
        }

        // A list to hold all the new referral mappings we need to create.
        List<PackageSessionEnrollInvitePaymentOptionPlanToReferralOption> referralsToSave = new ArrayList<>();

        for (int i = 0; i < originalDTOs.size(); i++) {
            PackageSessionToPaymentOptionDTO dto = originalDTOs.get(i);
            PackageSessionLearnerInvitationToPaymentOption persistedParent = savedMappings.get(i);

            // Check if the DTO has payment plans with referral options.
            if (Objects.isNull(dto.getPaymentOption()) || CollectionUtils.isEmpty(dto.getPaymentOption().getPaymentPlans())) {
                continue; // Skip to the next DTO.
            }

            // For each payment plan in the DTO, create the referral mapping.
            for (PaymentPlanDTO planDTO : dto.getPaymentOption().getPaymentPlans()) {
                if (Objects.nonNull(planDTO.getReferralOption()) && StringUtils.hasText(planDTO.getReferralOption().getId())) {

                    // Fetch the entities needed for the mapping.
                    Optional<PaymentPlan> optionalPlan = paymentPlanService.findById(planDTO.getId());
                    Optional<ReferralOption> optionalReferral = referralOptionService.getReferralOption(planDTO.getReferralOption().getId());

                    // If both exist, create the child mapping entity and add it to our list.
                    if (optionalPlan.isPresent() && optionalReferral.isPresent()) {
                        // This is the critical step: we create the child entity...
                        PackageSessionEnrollInvitePaymentOptionPlanToReferralOption childEntity =
                                new PackageSessionEnrollInvitePaymentOptionPlanToReferralOption(
                                        persistedParent, // ...using the PARENT that is ALREADY SAVED.
                                        optionalReferral.get(),
                                        optionalPlan.get(),
                                        StatusEnum.ACTIVE.name()
                                );
                        referralsToSave.add(childEntity);
                    }
                }
            }
        }

        // Save all the newly created referral mapping entities in a single batch operation.
        if (!referralsToSave.isEmpty()) {
            packageSessionEnrollInvitePaymentOptionPlanToReferralOptionService.saveInBulk(referralsToSave); // Assumes a service method that takes a list.
        }
    }


    /**
     * Validates an individual mapping DTO.
     */
    private void validateMappingDTO(PackageSessionToPaymentOptionDTO dto) {
        if (dto.getPackageSessionId() == null || dto.getPackageSessionId().isBlank()) {
            throw new VacademyException("packageSessionId is required in packageSessionToPaymentOptions.");
        }
        if (dto.getPaymentOption() == null || dto.getPaymentOption().getId() == null || dto.getPaymentOption().getId().isBlank()) {
            throw new VacademyException("paymentOption.id is required in packageSessionToPaymentOptions.");
        }
    }

    public Page<EnrollInviteWithSessionsProjection> getEnrollInvitesByInstituteIdAndFilters(String instituteId, EnrollInviteFilterDTO enrollInviteFilterDTO, int pageNo, int pageSize) {
        Sort sortColumns = ListService.createSortObject(enrollInviteFilterDTO.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize,sortColumns);
        Page<EnrollInviteWithSessionsProjection>enrollInvites = null;
        if (StringUtils.hasText(enrollInviteFilterDTO.getSearchName())){
            enrollInvites = repository.getEnrollInvitesByInstituteIdAndSearchName(instituteId,
                    enrollInviteFilterDTO.getSearchName(),
                    List.of(StatusEnum.ACTIVE.name()),
                    List.of(PackageSessionStatusEnum.ACTIVE.name()
                            ,PackageSessionStatusEnum.HIDDEN.name()),
                    pageable);
        }else{
            enrollInvites = repository.getEnrollInvitesWithFilters(instituteId,
                    enrollInviteFilterDTO.getPackageSessionIds(),
                    enrollInviteFilterDTO.getPaymentOptionIds(),
                    enrollInviteFilterDTO.getTags(),
                    List.of(StatusEnum.ACTIVE.name()),
                    List.of(PackageSessionStatusEnum.ACTIVE.name(),PackageSessionStatusEnum.HIDDEN.name()),
                    pageable);
        }
        return enrollInvites;
    }

    public EnrollInviteDTO findByEnrollInviteId(String enrollInviteId,String instituteId) {
        EnrollInvite enrollInvite = repository.findById(enrollInviteId).orElseThrow(()->new VacademyException("EnrollInvite not found"));
        EnrollInviteDTO enrollInviteDTO = enrollInvite.toEnrollInviteDTO();
        enrollInviteDTO.setInstituteCustomFields(instituteCustomFiledService.findCustomFieldsAsJson(instituteId, CustomFieldTypeEnum.ENROLL_INVITE.name(), enrollInviteId));
        List<PackageSessionToPaymentOptionDTO>packageSessionToPaymentOptionDTOS = packageSessionEnrollInviteToPaymentOptionService.findByInvite(enrollInvite);
        enrollInviteDTO.setPackageSessionToPaymentOptions(packageSessionToPaymentOptionDTOS);
        return enrollInviteDTO;
    }

    public EnrollInviteDTO findDefaultEnrollInviteByPackageSessionId(String packageSessionId,String instituteId) {
        EnrollInvite enrollInvite = repository.findLatestForPackageSessionWithFilters(
                packageSessionId,
                List.of(StatusEnum.ACTIVE.name()),
                List.of(EnrollInviteTag.DEFAULT.name()),
                List.of(StatusEnum.ACTIVE.name())).orElseThrow(()->new VacademyException("EnrollInvite not found"));
        EnrollInviteDTO enrollInviteDTO = enrollInvite.toEnrollInviteDTO();
        enrollInviteDTO.setInstituteCustomFields(instituteCustomFiledService.findCustomFieldsAsJson(instituteId, CustomFieldTypeEnum.ENROLL_INVITE.name(), enrollInvite.getId()));
        List<PackageSessionToPaymentOptionDTO>packageSessionToPaymentOptionDTOS = packageSessionEnrollInviteToPaymentOptionService.findByInvite(enrollInvite);
        enrollInviteDTO.setPackageSessionToPaymentOptions(packageSessionToPaymentOptionDTOS);
        return enrollInviteDTO;
    }

    private void removeDefaultTag(String packageSessionId) {
        Optional<EnrollInvite>optionalEnrollInvite = repository.findLatestForPackageSessionWithFilters(
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
        Optional<EnrollInvite>optionalEnrollInvite = repository.findById(enrollInviteId);
        if (optionalEnrollInvite.isPresent()) {
            EnrollInvite enrollInvite = optionalEnrollInvite.get();
            enrollInvite.setTag(EnrollInviteTag.DEFAULT.name());
            repository.save(enrollInvite);
        }else{
            throw new VacademyException("EnrollInvite not found");
        }
    }

    @Transactional
    public String updateDefaultEnrollInviteConfig(String enrollInviteId,String packageSessionId) {
        removeDefaultTag(packageSessionId);
        addDefaultTag(enrollInviteId);
        return enrollInviteId;
    }

    public List<EnrollInviteDTO> findByPaymentOptionIds(List<String>paymentOptionIds){
        return packageSessionEnrollInviteToPaymentOptionService.findByPaymentOptionId(paymentOptionIds);
    }

    @Transactional
    public String deleteEnrollInvites(List<String>enrollInviteIds) {
        List<EnrollInvite>enrollInvites = repository.findAllById(enrollInviteIds);
        for (EnrollInvite enrollInvite : enrollInvites) {
            enrollInvite.setStatus(StatusEnum.DELETED.name());
        }
        repository.saveAll(enrollInvites);
        packageSessionEnrollInviteToPaymentOptionService.deleteByEnrollInviteIds(enrollInviteIds);
        return "Enroll invites deleted successfully";
    }
}