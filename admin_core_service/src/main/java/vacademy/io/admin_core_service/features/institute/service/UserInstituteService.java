package vacademy.io.admin_core_service.features.institute.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.constants.ConstantsSettingDefaultValue;
import vacademy.io.admin_core_service.features.institute.constants.ConstantsSubModuleList;
import vacademy.io.admin_core_service.features.institute.dto.InstituteDashboardResponse;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteSubModuleRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectPackageSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.common.institute.dto.InstituteInfoDTO;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.module.InstituteSubModule;
import vacademy.io.common.institute.entity.module.Submodule;
import vacademy.io.common.institute.repository.SubModuleRepository;
import vacademy.io.admin_core_service.features.credits.client.CreditClient;
import vacademy.io.admin_core_service.features.institute.entity.InstituteSubOrg;
import vacademy.io.admin_core_service.features.institute.repository.InstituteSubOrgRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Slf4j
@Service
public class UserInstituteService {

    @Autowired
    InstituteSubModuleRepository instituteSubModuleRepository;
    @Autowired
    private InstituteSubOrgRepository instituteSubOrgRepository;
    @Autowired
    SubModuleRepository subModuleRepository;
    @Autowired
    PackageSessionRepository packageSessionRepository;
    @Autowired
    StudentSessionRepository studentSessionRepository;
    @Autowired
    private InstituteRepository instituteRepository;
    @Autowired
    private PackageRepository packageRepository;
    @Autowired
    private SubjectPackageSessionRepository subjectPackageSessionRepository;
    @Autowired
    private InstituteSettingService instituteSettingService;
    @Autowired
    private InstituteDefaultUserSubscriptionService instituteDefaultUserSubscriptionService;
    @Autowired
    private CreditClient creditClient;

    public static InstituteInfoDTO getInstituteDetails(Institute institute) {
        InstituteInfoDTO instituteInfoDTO = new InstituteInfoDTO();
        instituteInfoDTO.setId(institute.getId());
        instituteInfoDTO.setInstituteName(institute.getInstituteName());
        instituteInfoDTO.setCountry(institute.getCountry());
        instituteInfoDTO.setState(institute.getState());
        instituteInfoDTO.setCity(institute.getCity());
        instituteInfoDTO.setAddress(institute.getAddress());
        instituteInfoDTO.setPinCode(institute.getPinCode());
        instituteInfoDTO.setEmail(institute.getEmail());
        instituteInfoDTO.setPhone(institute.getMobileNumber());
        instituteInfoDTO.setWebsiteUrl(institute.getWebsiteUrl());
        instituteInfoDTO.setBoard(institute.getBoard());
        instituteInfoDTO.setGstDetails(institute.getGstDetails());
        instituteInfoDTO.setAffiliationNumber(institute.getAffiliationNumber());
        instituteInfoDTO.setStaffStrength(institute.getStaffStrength());
        instituteInfoDTO.setSchoolStrength(institute.getSchoolStrength());
        return instituteInfoDTO;
    }

    @Transactional
    public InstituteIdAndNameDTO saveInstitute(InstituteInfoDTO instituteDto) {
        try {
            // Debug logging for institute fields - to trace production issues
            log.info("[ADMIN-CORE-SERVICE] saveInstitute - Input InstituteInfoDTO:");
            log.info("[ADMIN-CORE-SERVICE] board: {}",
                    instituteDto != null ? instituteDto.getBoard() : "null (DTO is null)");
            log.info("[ADMIN-CORE-SERVICE] gstDetails: {}",
                    instituteDto != null ? instituteDto.getGstDetails() : "null (DTO is null)");
            log.info("[ADMIN-CORE-SERVICE] affiliationNumber: {}",
                    instituteDto != null ? instituteDto.getAffiliationNumber() : "null (DTO is null)");
            log.info("[ADMIN-CORE-SERVICE] staffStrength: {}",
                    instituteDto != null ? instituteDto.getStaffStrength() : "null (DTO is null)");
            log.info("[ADMIN-CORE-SERVICE] schoolStrength: {}",
                    instituteDto != null ? instituteDto.getSchoolStrength() : "null (DTO is null)");

            List<Submodule> allSubModules = new ArrayList<>();

            if (!Objects.isNull(instituteDto.getModuleRequestIds())) {

                instituteDto.getModuleRequestIds().forEach(id -> {
                    List<String> subModuleId = ConstantsSubModuleList.getSubModulesForModule(id);
                    allSubModules.addAll(subModuleRepository.findAllById(subModuleId));
                });
            }

            Institute institute = getInstitute(instituteDto);

            // Debug logging after entity creation
            log.info("[ADMIN-CORE-SERVICE] saveInstitute - Institute entity after getInstitute():");
            log.info("[ADMIN-CORE-SERVICE] institute.board: {}", institute.getBoard());
            log.info("[ADMIN-CORE-SERVICE] institute.gstDetails: {}", institute.getGstDetails());
            log.info("[ADMIN-CORE-SERVICE] institute.affiliationNumber: {}", institute.getAffiliationNumber());
            log.info("[ADMIN-CORE-SERVICE] institute.staffStrength: {}", institute.getStaffStrength());
            log.info("[ADMIN-CORE-SERVICE] institute.schoolStrength: {}", institute.getSchoolStrength());

            if (institute.getInstituteName() != null) {
                Institute savedInstitute = instituteRepository.save(institute);

                // Debug logging after save
                log.info("[ADMIN-CORE-SERVICE] saveInstitute - Institute saved with ID: {}", savedInstitute.getId());
                log.info("[ADMIN-CORE-SERVICE] savedInstitute.board: {}", savedInstitute.getBoard());
                log.info("[ADMIN-CORE-SERVICE] savedInstitute.gstDetails: {}", savedInstitute.getGstDetails());
                log.info("[ADMIN-CORE-SERVICE] savedInstitute.affiliationNumber: {}",
                        savedInstitute.getAffiliationNumber());
                log.info("[ADMIN-CORE-SERVICE] savedInstitute.staffStrength: {}", savedInstitute.getStaffStrength());
                log.info("[ADMIN-CORE-SERVICE] savedInstitute.schoolStrength: {}", savedInstitute.getSchoolStrength());

                instituteSettingService.createDefaultSettingsForInstitute(savedInstitute);
                createInstituteSubModulesMapping(allSubModules, savedInstitute);
                instituteDefaultUserSubscriptionService.createDefaultPaymentOption(institute.getId());

                // Initialize credits for the new institute (200 initial credits)
                creditClient.initializeCreditsAsync(savedInstitute.getId());

                return new InstituteIdAndNameDTO(savedInstitute.getId(), savedInstitute.getInstituteName());
            }

            return null;
        } catch (Exception e) {
            log.error("[ADMIN-CORE-SERVICE] saveInstitute - Error saving institute: {}", e.getMessage(), e);
            throw new VacademyException("Failed to add: " + e.getMessage());
        }
    }

    private void createInstituteSubModulesMapping(List<Submodule> allSubModules, Institute institute) {
        List<InstituteSubModule> allInstituteMapping = new ArrayList<>();
        allSubModules.forEach(submodule -> {
            allInstituteMapping.add(InstituteSubModule.builder()
                    .instituteId(institute.getId())
                    .submodule(submodule).build());
        });

        instituteSubModuleRepository.saveAll(allInstituteMapping);
    }

    private Institute getInstitute(InstituteInfoDTO instituteInfo) {
        Institute institute = new Institute();
        institute.setInstituteName(instituteInfo.getInstituteName());
        institute.setCountry(instituteInfo.getCountry());
        institute.setState(instituteInfo.getState());
        institute.setCity(instituteInfo.getCity());
        institute.setAddress(instituteInfo.getAddress());
        institute.setPinCode(instituteInfo.getPinCode());
        institute.setEmail(instituteInfo.getEmail());
        institute.setMobileNumber(instituteInfo.getPhone());
        institute.setWebsiteUrl(instituteInfo.getWebsiteUrl());
        institute.setLogoFileId(instituteInfo.getInstituteLogoFileId());
        institute.setLetterHeadFileId(instituteInfo.getLetterHeadFileId());
        institute.setInstituteType(instituteInfo.getType());
        institute.setInstituteThemeCode(instituteInfo.getInstituteThemeCode());
        institute.setBoard(instituteInfo.getBoard());
        institute.setGstDetails(instituteInfo.getGstDetails());
        institute.setAffiliationNumber(instituteInfo.getAffiliationNumber());
        institute.setStaffStrength(instituteInfo.getStaffStrength());
        institute.setSchoolStrength(instituteInfo.getSchoolStrength());
        return institute;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<InstituteDashboardResponse> getInstituteDashboardDetail(CustomUserDetails user,
            String instituteId) {
        Optional<Institute> instituteOptional = instituteRepository.findById(instituteId);
        if (instituteOptional.isEmpty())
            throw new VacademyException("Institute Not Found");

        Integer emptyOrNullFieldsCount = instituteRepository.findCountForNullOrEmptyFields(instituteId);
        Integer percentage = (((11 - emptyOrNullFieldsCount) * 100) / 11);
        Long batchCount = packageSessionRepository.findCountPackageSessionsByInstituteIdAndStatusIn(instituteId,
                List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()));
        Long studentCount = studentSessionRepository.countStudentsByInstituteIdAndStatusNotInAndPackageSessionStatusIn(
                instituteId, List.of("DELETED", "INACTIVE", "TERMINATED"),
                List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()));
        Long courseCount = packageRepository.countDistinctPackagesByInstituteId(instituteId);
        Long levelCount = packageRepository.countDistinctLevelsByInstituteId(instituteId);
        Long subjectCount = subjectPackageSessionRepository.countDistinctSubjectsByInstituteId(instituteId);
        return ResponseEntity.ok(InstituteDashboardResponse.builder()
                .id(instituteId)
                .profileCompletionPercentage(percentage)
                .batchCount(batchCount)
                .studentCount(studentCount)
                .courseCount(courseCount)
                .levelCount(levelCount)
                .subjectCount(subjectCount)
                .build());
    }

    public ResponseEntity<String> updateInstituteDetails(CustomUserDetails user, String instituteId,
            InstituteInfoDTO instituteInfoDTO) {
        if (Objects.isNull(instituteInfoDTO))
            throw new VacademyException("Invalid Request");

        // Debug logging for update request - to trace production issues
        log.info("[ADMIN-CORE-SERVICE] updateInstituteDetails - Input InstituteInfoDTO for instituteId: {}",
                instituteId);
        log.info("[ADMIN-CORE-SERVICE] incoming board: {}", instituteInfoDTO.getBoard());
        log.info("[ADMIN-CORE-SERVICE] incoming gstDetails: {}", instituteInfoDTO.getGstDetails());
        log.info("[ADMIN-CORE-SERVICE] incoming affiliationNumber: {}", instituteInfoDTO.getAffiliationNumber());
        log.info("[ADMIN-CORE-SERVICE] incoming staffStrength: {}", instituteInfoDTO.getStaffStrength());
        log.info("[ADMIN-CORE-SERVICE] incoming schoolStrength: {}", instituteInfoDTO.getSchoolStrength());

        Optional<Institute> instituteOptional = instituteRepository.findById(instituteId);

        if (instituteOptional.isEmpty())
            throw new VacademyException("Institute Not Found");
        Institute institute = instituteOptional.get();

        // Debug logging for current DB values
        log.info("[ADMIN-CORE-SERVICE] updateInstituteDetails - Current DB values:");
        log.info("[ADMIN-CORE-SERVICE] current board: {}", institute.getBoard());
        log.info("[ADMIN-CORE-SERVICE] current gstDetails: {}", institute.getGstDetails());
        log.info("[ADMIN-CORE-SERVICE] current affiliationNumber: {}", institute.getAffiliationNumber());
        log.info("[ADMIN-CORE-SERVICE] current staffStrength: {}", institute.getStaffStrength());
        log.info("[ADMIN-CORE-SERVICE] current schoolStrength: {}", institute.getSchoolStrength());

        updateIfNotNull(instituteInfoDTO.getInstituteName(), institute::setInstituteName);
        updateIfNotNull(instituteInfoDTO.getType(), institute::setInstituteType);
        updateIfNotNull(instituteInfoDTO.getEmail(), institute::setEmail);
        updateIfNotNull(instituteInfoDTO.getPhone(), institute::setMobileNumber);
        updateIfNotNull(instituteInfoDTO.getWebsiteUrl(), institute::setWebsiteUrl);
        updateIfNotNull(instituteInfoDTO.getAddress(), institute::setAddress);
        updateIfNotNull(instituteInfoDTO.getCountry(), institute::setCountry);
        updateIfNotNull(instituteInfoDTO.getState(), institute::setState);
        updateIfNotNull(instituteInfoDTO.getCity(), institute::setCity);
        updateIfNotNull(instituteInfoDTO.getInstituteThemeCode(), institute::setInstituteThemeCode);
        updateIfNotNull(instituteInfoDTO.getPinCode(), institute::setPinCode);
        updateIfNotNull(instituteInfoDTO.getInstituteLogoFileId(), institute::setLogoFileId);
        updateIfNotNull(instituteInfoDTO.getBoard(), institute::setBoard);
        updateIfNotNull(instituteInfoDTO.getGstDetails(), institute::setGstDetails);
        updateIfNotNull(instituteInfoDTO.getAffiliationNumber(), institute::setAffiliationNumber);
        updateIfNotNull(instituteInfoDTO.getStaffStrength(), institute::setStaffStrength);
        updateIfNotNull(instituteInfoDTO.getSchoolStrength(), institute::setSchoolStrength);

        // Debug logging for values after update (before save)
        log.info("[ADMIN-CORE-SERVICE] updateInstituteDetails - Values after update (before save):");
        log.info("[ADMIN-CORE-SERVICE] final board: {}", institute.getBoard());
        log.info("[ADMIN-CORE-SERVICE] final gstDetails: {}", institute.getGstDetails());
        log.info("[ADMIN-CORE-SERVICE] final affiliationNumber: {}", institute.getAffiliationNumber());
        log.info("[ADMIN-CORE-SERVICE] final staffStrength: {}", institute.getStaffStrength());
        log.info("[ADMIN-CORE-SERVICE] final schoolStrength: {}", institute.getSchoolStrength());

        instituteRepository.save(institute);
        log.info("[ADMIN-CORE-SERVICE] updateInstituteDetails - Institute saved successfully");

        return ResponseEntity.ok("Done");
    }

    /**
     * Helper method to update a field if the new value is not null.
     *
     * @param value        The new value to set.
     * @param setterMethod A method reference to set the value.
     * @param <T>          The type of the value being updated.
     */
    private <T> void updateIfNotNull(T value, java.util.function.Consumer<T> setterMethod) {
        if (value != null) {
            setterMethod.accept(value);
        }
    }

    public String addLetterHeadFileId(String instituteId, String letterHeadFileId, CustomUserDetails userDetails) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");
        institute.get().setLetterHeadFileId(letterHeadFileId);
        instituteRepository.save(institute.get());
        return "Done";
    }

    public String getLetterFileId(String instituteId, CustomUserDetails userDetails) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");
        return institute.get().getLetterHeadFileId();
    }

    @Transactional
    public String createSubOrg(InstituteInfoDTO instituteInfoDTO, String parentInstituteId) {
        // 1. Create the child institute using existing logic
        InstituteIdAndNameDTO createdInstitute = saveInstitute(instituteInfoDTO);

        if (createdInstitute == null) {
            throw new VacademyException("Failed to create sub-organization institute");
        }

        // 2. Link parent and child in InstituteSubOrg table
        InstituteSubOrg mapping = new InstituteSubOrg();
        mapping.setInstituteId(parentInstituteId);
        mapping.setSuborgId(createdInstitute.getId());
        mapping.setStatus("ACTIVE");
        mapping.setName(instituteInfoDTO.getInstituteName());
        mapping.setDescription(instituteInfoDTO.getDescription());

        instituteSubOrgRepository.save(mapping);

        return createdInstitute.getId();
    }
}
