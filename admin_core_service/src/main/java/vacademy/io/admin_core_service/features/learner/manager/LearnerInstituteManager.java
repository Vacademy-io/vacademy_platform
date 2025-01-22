package vacademy.io.admin_core_service.features.learner.manager;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.InstituteModuleService;
import vacademy.io.admin_core_service.features.learner.dto.StudentInstituteInfoDTO;
import vacademy.io.admin_core_service.features.student.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.student.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectPackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.InstituteInfoDTO;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

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

        List<StudentSessionInstituteGroupMapping> studentSessions = studentSessionRepository.findAllByInstituteIdAndUserId(instituteId, userId);
        Set<PackageSession> packageSessions = new HashSet<>();

        for (StudentSessionInstituteGroupMapping studentSession : studentSessions) {
            packageSessions.add(studentSession.getPackageSession());
        }
        instituteInfoDTO.setSubjects(subjectRepository.findDistinctSubjectsOfPackageSessions(packageSessions.stream().map(PackageSession::getId).toList()).stream().map(SubjectDTO::new).toList());
        return instituteInfoDTO;
    }
}
