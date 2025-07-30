package vacademy.io.admin_core_service.features.institute.manager;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.group.repository.PackageGroupMappingRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.InstituteModuleService;
import vacademy.io.admin_core_service.features.institute.utils.InstituteSettingUtils;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.auth.enums.Gender;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.*;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

@Component
public class InstituteInitManager {

    @Autowired
    InstituteModuleService instituteModuleService;
    @Autowired
    InstituteRepository instituteRepository;

    @Autowired
    PackageRepository packageRepository;

    @Autowired
    SubjectRepository subjectRepository;

    @Autowired
    PackageSessionRepository packageSessionRepository;

    @Autowired
    private PackageGroupMappingRepository packageGroupMappingRepository;

    @Transactional
    public InstituteInfoDTO getInstituteDetails(String instituteId) {

        Optional<Institute> institute = instituteRepository.findById(instituteId);

        ObjectMapper objectMapper = new ObjectMapper();
        if (institute.isEmpty()) {
            throw new VacademyException("Invalid Institute Id");
        }

        InstituteInfoDTO instituteInfoDTO = new InstituteInfoDTO();
        instituteInfoDTO.setInstituteName(institute.get().getInstituteName());
        instituteInfoDTO.setId(institute.get().getId());
        instituteInfoDTO.setTags(packageRepository.findAllDistinctTagsByInstituteId(instituteId));
        instituteInfoDTO.setCity(institute.get().getCity());
        instituteInfoDTO.setCountry(institute.get().getCountry());
        instituteInfoDTO.setWebsiteUrl(institute.get().getWebsiteUrl());
        instituteInfoDTO.setEmail(institute.get().getEmail());
        instituteInfoDTO.setPinCode(institute.get().getPinCode());
        instituteInfoDTO.setInstituteLogoFileId(institute.get().getLogoFileId());
        instituteInfoDTO.setDescription(institute.get().getDescription());
        instituteInfoDTO.setHeldBy(institute.get().getHeldBy());
        instituteInfoDTO.setFoundedDate(institute.get().getFoundedData());
        instituteInfoDTO.setPhone(institute.get().getMobileNumber());
        instituteInfoDTO.setAddress(institute.get().getAddress());
        instituteInfoDTO.setType(institute.get().getInstituteType());
        instituteInfoDTO.setState(institute.get().getState());
        instituteInfoDTO.setLanguage(institute.get().getLanguage());
        instituteInfoDTO.setInstituteThemeCode(institute.get().getInstituteThemeCode());
        instituteInfoDTO.setSubModules(instituteModuleService.getSubmoduleIdsForInstitute(institute.get().getId()));
        instituteInfoDTO.setSessions(packageRepository.findDistinctSessionsByInstituteIdAndStatusIn(institute.get().getId(), List.of(PackageSessionStatusEnum.ACTIVE.name())).stream().map((SessionDTO::new)).toList());
        instituteInfoDTO.setBatchesForSessions(packageSessionRepository.findPackageSessionsByInstituteId(institute.get().getId(), List.of(PackageSessionStatusEnum.ACTIVE.name())).stream().map((obj) -> {
            return new PackageSessionDTO(obj);
        }).toList());
        instituteInfoDTO.setLevels(packageRepository.findDistinctLevelsByInstituteIdAndStatusIn(institute.get().getId(), List.of(PackageSessionStatusEnum.ACTIVE.name())).stream().map((LevelDTO::new)).toList());
        instituteInfoDTO.setGenders((Stream.of(Gender.values()).map(Enum::name)).toList());
        instituteInfoDTO.setStudentStatuses(List.of("ACTIVE", "INACTIVE"));
        instituteInfoDTO.setSubjects(subjectRepository.findDistinctSubjectsByInstituteId(institute.get().getId()).stream().map((SubjectDTO::new)).toList());
        instituteInfoDTO.setSessionExpiryDays(List.of(30, 180, 360));
        instituteInfoDTO.setLetterHeadFileId(institute.get().getLetterHeadFileId());
        instituteInfoDTO.setPackageGroups(packageGroupMappingRepository.findAllByInstituteId(institute.get().getId()).stream().map((obj)->obj.mapToDTO()).toList());
        instituteInfoDTO.setSetting(institute.get().getSetting());
        instituteInfoDTO.setCoverImageFileId(institute.get().getCoverImageFileId());
        instituteInfoDTO.setCoverTextJson(institute.get().getCoverTextJson());
        return instituteInfoDTO;
    }

    @Transactional
    public InstituteInfoDTO getPublicInstituteDetails(String instituteId) {

        Optional<Institute> institute = instituteRepository.findById(instituteId);

        ObjectMapper objectMapper = new ObjectMapper();
        if (institute.isEmpty()) {
            throw new VacademyException("Invalid Institute Id");
        }

        InstituteInfoDTO instituteInfoDTO = new InstituteInfoDTO();
        instituteInfoDTO.setInstituteName(institute.get().getInstituteName());
        instituteInfoDTO.setId(institute.get().getId());
        instituteInfoDTO.setCity(institute.get().getCity());
        instituteInfoDTO.setCountry(institute.get().getCountry());
        instituteInfoDTO.setWebsiteUrl(institute.get().getWebsiteUrl());
        instituteInfoDTO.setPinCode(institute.get().getPinCode());
        instituteInfoDTO.setInstituteLogoFileId(institute.get().getLogoFileId());
        instituteInfoDTO.setDescription(institute.get().getDescription());
        instituteInfoDTO.setHeldBy(institute.get().getHeldBy());
        instituteInfoDTO.setFoundedDate(institute.get().getFoundedData());
        instituteInfoDTO.setAddress(institute.get().getAddress());
        instituteInfoDTO.setType(institute.get().getInstituteType());
        instituteInfoDTO.setState(institute.get().getState());
        instituteInfoDTO.setLanguage(institute.get().getLanguage());
        instituteInfoDTO.setInstituteThemeCode(institute.get().getInstituteThemeCode());
        instituteInfoDTO.setSubModules(instituteModuleService.getSubmoduleIdsForInstitute(institute.get().getId()));
        instituteInfoDTO.setSessions(packageRepository.findDistinctSessionsByInstituteIdAndStatusIn(institute.get().getId(), List.of(PackageSessionStatusEnum.ACTIVE.name())).stream().map((SessionDTO::new)).toList());
        instituteInfoDTO.setLevels(packageRepository.findDistinctLevelsByInstituteIdAndStatusIn(institute.get().getId(), List.of(PackageSessionStatusEnum.ACTIVE.name())).stream().map((LevelDTO::new)).toList());
        instituteInfoDTO.setPackageGroups(packageGroupMappingRepository.findAllByInstituteId(institute.get().getId()).stream().map((obj)->obj.mapToDTO()).toList());
        instituteInfoDTO.setTags(packageRepository.findAllDistinctTagsByInstituteId(institute.get().getId()));
        instituteInfoDTO.setCoverImageFileId(institute.get().getCoverImageFileId());
        instituteInfoDTO.setCoverTextJson(institute.get().getCoverTextJson());
        instituteInfoDTO.setBatchesForSessions(packageSessionRepository.findPackageSessionsByInstituteId(institute.get().getId(), List.of(PackageSessionStatusEnum.ACTIVE.name())).stream().map((obj) -> {
            return new PackageSessionDTO(obj);
        }).toList());
        return instituteInfoDTO;
    }

    public ResponseEntity<String> getInstituteIdOrSubDomain(String instituteId, String subdomain) {
        if(Objects.isNull(instituteId) && Objects.isNull(subdomain)) throw new VacademyException("Invalid Request");

        if(Objects.isNull(instituteId)){
            Optional<Institute> institute = instituteRepository.findBySubdomainLimit1(subdomain);
            if(institute.isEmpty()) return ResponseEntity.ok("Data not found");
            return ResponseEntity.ok(institute.get().getId());
        }

        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) return ResponseEntity.ok("Data not found");
        return ResponseEntity.ok(institute.get().getSubdomain());
    }
}
