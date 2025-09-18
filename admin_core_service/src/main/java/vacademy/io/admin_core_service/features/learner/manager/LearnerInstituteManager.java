package vacademy.io.admin_core_service.features.learner.manager;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.InstituteModuleService;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner.dto.StudentInstituteInfoDTO;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.slide.service.SlideService;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.PackageSessionDTO;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.*;

@Component
public class LearnerInstituteManager {

    @Autowired
    StudentSessionRepository studentSessionRepository;

    @Autowired
    InstituteRepository instituteRepository;

    @Autowired
    InstituteModuleService instituteModuleService;

    @Autowired
    SubjectRepository subjectRepository;

    @Autowired
    PackageSessionRepository packageSessionRepository;

    @Autowired
    private SlideService slideService;

    @Transactional
    public StudentInstituteInfoDTO getInstituteDetails(String instituteId, String userId) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);

        ObjectMapper objectMapper = new ObjectMapper();
        if (institute.isEmpty()) {
            throw new VacademyException("Invalid Institute Id");
        }

        StudentInstituteInfoDTO instituteInfoDTO = new StudentInstituteInfoDTO();
        instituteInfoDTO.setInstituteName(institute.get().getInstituteName());
        instituteInfoDTO.setId(institute.get().getId());
        instituteInfoDTO.setCity(institute.get().getCity());
        instituteInfoDTO.setCountry(institute.get().getCountry());
        instituteInfoDTO.setWebsiteUrl(institute.get().getWebsiteUrl());
        instituteInfoDTO.setEmail(institute.get().getEmail());
        instituteInfoDTO.setPinCode(institute.get().getPinCode());
        instituteInfoDTO.setInstituteLogoFileId(institute.get().getLogoFileId());
        instituteInfoDTO.setPhone(institute.get().getMobileNumber());
        instituteInfoDTO.setAddress(institute.get().getAddress());
        instituteInfoDTO.setState(institute.get().getState());
        instituteInfoDTO.setInstituteThemeCode(institute.get().getInstituteThemeCode());
        instituteInfoDTO.setSubModules(instituteModuleService.getSubmoduleIdsForInstitute(institute.get().getId()));
        instituteInfoDTO.setBatchesForSessions(packageSessionRepository.findPackageSessionsByInstituteId(institute.get().getId(), List.of(PackageSessionStatusEnum.ACTIVE.name())).stream().map((obj) -> {
            return new PackageSessionDTO(obj,getReadTimeOfPackageSession(obj.getId()));
        }).toList());
        List<StudentSessionInstituteGroupMapping> studentSessions = studentSessionRepository.findAllByInstituteIdAndUserId(instituteId, userId);
        Set<PackageSession> packageSessions = new HashSet<>();

        for (StudentSessionInstituteGroupMapping studentSession : studentSessions) {
            if (studentSession.getPackageSession() != null)
                packageSessions.add(studentSession.getPackageSession());
        }
        if (!packageSessions.isEmpty()) {
            instituteInfoDTO.setSubjects(subjectRepository.findDistinctSubjectsOfPackageSessions(packageSessions.stream().map(PackageSession::getId).toList()).stream().map(SubjectDTO::new).toList());
        }
        if (institute.get().getSetting() != null) {
            instituteInfoDTO.setInstituteSettingsJson(institute.get().getSetting());
        }

        return instituteInfoDTO;
    }

    public List<StudentInstituteInfoDTO> getInstituteDetailsByIds(String instituteIds, String userId) {
        List<String> instituteIdList = List.of(instituteIds.split(","));
        List<StudentInstituteInfoDTO> instituteInfoDTOList = new ArrayList<>();
        Iterable<Institute> institute = instituteRepository.findAllById(instituteIdList);
        for (Institute thisInstitute : institute) {
            StudentInstituteInfoDTO instituteInfoDTO = new StudentInstituteInfoDTO();
            instituteInfoDTO.setInstituteName(thisInstitute.getInstituteName());
            instituteInfoDTO.setId(thisInstitute.getId());
            instituteInfoDTO.setCity(thisInstitute.getCity());
            instituteInfoDTO.setCountry(thisInstitute.getCountry());
            instituteInfoDTOList.add(instituteInfoDTO);
        }
        return instituteInfoDTOList;
    }

    private Double getReadTimeOfPackageSession(String packageSessionId){
        return slideService.calculateTotalReadTimeInMinutes(packageSessionId);
    }
}
