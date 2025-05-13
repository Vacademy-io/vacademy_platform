package vacademy.io.admin_core_service.features.institute.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.constants.ConstantsSubModuleList;
import vacademy.io.admin_core_service.features.institute.dto.InstituteDashboardResponse;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteSubModuleRepository;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;


@Service
public class UserInstituteService {

    @Autowired
    InstituteSubModuleRepository instituteSubModuleRepository;
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
        return instituteInfoDTO;
    }

    @Transactional
    public InstituteIdAndNameDTO saveInstitute(InstituteInfoDTO instituteDto) {
        try {
            List<Submodule> allSubModules = new ArrayList<>();

            if (!Objects.isNull(instituteDto.getModuleRequestIds())) {

                instituteDto.getModuleRequestIds().forEach(id -> {
                    List<String> subModuleId = ConstantsSubModuleList.getSubModulesForModule(id);
                    allSubModules.addAll(subModuleRepository.findAllById(subModuleId));
                });
            }

            Institute institute = getInstitute(instituteDto);

            if (institute.getInstituteName() != null) {
                Institute savedInstitute = instituteRepository.save(institute);

                createInstituteSubModulesMapping(allSubModules, savedInstitute);

                return new InstituteIdAndNameDTO(savedInstitute.getId(), savedInstitute.getInstituteName());
            }

            return null;
        } catch (Exception e) {
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
        return institute;
    }


    public ResponseEntity<InstituteDashboardResponse> getInstituteDashboardDetail(CustomUserDetails user, String instituteId) {
        Optional<Institute> instituteOptional = instituteRepository.findById(instituteId);
        if (instituteOptional.isEmpty()) throw new VacademyException("Institute Not Found");

        Integer emptyOrNullFieldsCount = instituteRepository.findCountForNullOrEmptyFields(instituteId);
        Integer percentage = (((11 - emptyOrNullFieldsCount) * 100) / 11);
        Long batchCount = packageSessionRepository.findCountPackageSessionsByInstituteIdAndStatusIn(instituteId,List.of(PackageSessionStatusEnum.ACTIVE.name(),PackageSessionStatusEnum.HIDDEN.name()));
        Long studentCount = studentSessionRepository.countStudentsByInstituteIdAndStatusNotInAndPackageSessionStatusIn(instituteId, List.of("DELETED", "INACTIVE", "TERMINATED"),List.of(PackageSessionStatusEnum.ACTIVE.name(),PackageSessionStatusEnum.HIDDEN.name()));
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


    public ResponseEntity<String> updateInstituteDetails(CustomUserDetails user, String instituteId, InstituteInfoDTO instituteInfoDTO) {
        if (Objects.isNull(instituteInfoDTO)) throw new VacademyException("Invalid Request");

        Optional<Institute> instituteOptional = instituteRepository.findById(instituteId);

        if (instituteOptional.isEmpty()) throw new VacademyException("Institute Not Found");
        Institute institute = instituteOptional.get();

        updateIfNotNull(instituteInfoDTO.getInstituteName(), institute::setInstituteName);
        updateIfNotNull(instituteInfoDTO.getType(), institute::setInstituteType);
        updateIfNotNull(instituteInfoDTO.getEmail(), institute::setEmail);
        updateIfNotNull(instituteInfoDTO.getPhone(), institute::setMobileNumber);
        updateIfNotNull(instituteInfoDTO.getWebsiteUrl(), institute::setWebsiteUrl);
        updateIfNotNull(instituteInfoDTO.getAddress(), institute::setAddress);
        updateIfNotNull(instituteInfoDTO.getCountry(), institute::setCountry);
        updateIfNotNull(instituteInfoDTO.getState(), institute::setState);
        updateIfNotNull(instituteInfoDTO.getCity(), institute::setCity);
        updateIfNotNull(instituteInfoDTO.getPinCode(), institute::setPinCode);
        updateIfNotNull(instituteInfoDTO.getInstituteLogoFileId(), institute::setLogoFileId);

        instituteRepository.save(institute);

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
        if (institute.isEmpty()) throw new VacademyException("Institute Not Found");
        institute.get().setLetterHeadFileId(letterHeadFileId);
        instituteRepository.save(institute.get());
        return "Done";
    }

    public String getLetterFileId(String instituteId, CustomUserDetails userDetails) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty()) throw new VacademyException("Institute Not Found");
        return institute.get().getLetterHeadFileId();
    }
}
