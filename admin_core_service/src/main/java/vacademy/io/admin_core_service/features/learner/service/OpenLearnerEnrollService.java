package vacademy.io.admin_core_service.features.learner.service;

import jakarta.transaction.Transactional;
import org.apache.commons.lang3.RandomStringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.learner.dto.OpenLearnerEnrollRequestDTO;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Service
public class OpenLearnerEnrollService {

    @Autowired
    private AuthService authService;

    @Autowired
    private StudentSessionInstituteGroupMappingRepository mappingRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private InstituteStudentRepository instituteStudentRepository;

    @Transactional
    public String enrollUserInPackageSession(OpenLearnerEnrollRequestDTO requestDTO, String instituteId) {
        UserDTO user = createOrFetchUser(requestDTO, instituteId);
        PackageSession packageSession = resolvePackageSession(requestDTO);
        ensureStudentExists(user);
        validateMapping(requestDTO, user);
        StudentSessionInstituteGroupMapping mapping = buildMapping(requestDTO, user, packageSession, instituteId);
        mappingRepository.save(mapping);
        return "Success";
    }

    private UserDTO createOrFetchUser(OpenLearnerEnrollRequestDTO requestDTO, String instituteId) {
        return authService.createUserFromAuthService(requestDTO.getUserDTO(), instituteId, true);
    }

    private PackageSession resolvePackageSession(OpenLearnerEnrollRequestDTO requestDTO) {
        if (StringUtils.hasText(requestDTO.getPackageSessionId())) {
            return getInvitedPackageSession(requestDTO.getPackageSessionId());
        }
        return getDefaultPackageSession();
    }

    private void ensureStudentExists(UserDTO user) {
        Optional<Student> studentOpt = instituteStudentRepository.findByUserId(user.getId());
        if (studentOpt.isEmpty()) {
            Student student = new Student(user);
            instituteStudentRepository.save(student);
        }
    }

    private void validateMapping(OpenLearnerEnrollRequestDTO requestDTO, UserDTO user) {
        String source = requestDTO.getSource();
        String type = requestDTO.getType();
        String typeId = requestDTO.getTypeId();

        Optional<StudentSessionInstituteGroupMapping> mapping = Optional.empty();

        if (StringUtils.hasText(source) && StringUtils.hasText(type) && StringUtils.hasText(typeId)) {
            mapping = mappingRepository.findBySourceAndTypeIdAndTypeAndStatus(
                    source, typeId, type, LearnerStatusEnum.INVITED.name());
        } else if (StringUtils.hasText(source) && StringUtils.hasText(type)) {
            mapping = mappingRepository.findBySourceAndTypeAndStatus(
                    source, type, LearnerStatusEnum.INVITED.name());
        } else if (StringUtils.hasText(source) && StringUtils.hasText(typeId)) {
            mapping = mappingRepository.findBySourceAndTypeIdAndStatus(
                    source, typeId, LearnerStatusEnum.INVITED.name());
        } else if (StringUtils.hasText(type) && StringUtils.hasText(typeId)) {
            mapping = mappingRepository.findByTypeAndTypeIdAndStatus(
                    type, typeId, LearnerStatusEnum.INVITED.name());
        } else if (StringUtils.hasText(source)) {
            mapping = mappingRepository.findBySourceAndStatus(
                    source, LearnerStatusEnum.INVITED.name());
        } else if (StringUtils.hasText(type)) {
            mapping = mappingRepository.findByTypeAndStatus(
                    type, LearnerStatusEnum.INVITED.name());
        } else if (StringUtils.hasText(typeId)) {
            mapping = mappingRepository.findByTypeIdAndStatus(
                    typeId, LearnerStatusEnum.INVITED.name());
        }

        if (mapping.isPresent()) {
            throw new VacademyException("User entry already exists");
        }
    }


    private StudentSessionInstituteGroupMapping buildMapping(OpenLearnerEnrollRequestDTO requestDTO,
                                                             UserDTO user,
                                                             PackageSession packageSession,
                                                             String instituteId) {
        StudentSessionInstituteGroupMapping mapping = new StudentSessionInstituteGroupMapping();
        mapping.setSource(requestDTO.getSource());
        mapping.setTypeId(requestDTO.getTypeId());
        mapping.setType(requestDTO.getType());
        mapping.setStatus(LearnerStatusEnum.INVITED.name());
        mapping.setPackageSession(packageSession);
        mapping.setUserId(user.getId());
        mapping.setEnrolledDate(new Date());
        mapping.setInstitute(instituteRepository.findById(instituteId).orElseThrow());

        if (StringUtils.hasText(requestDTO.getPackageSessionId())) {
            mapping.setDestinationPackageSession(
                    packageSessionRepository.findById(requestDTO.getPackageSessionId()).orElseThrow()
            );
        }
        return mapping;
    }

    private PackageSession getInvitedPackageSession(String packageSessionId) {
        return packageSessionRepository.findInvitedPackageSessionForPackage(
                packageSessionId,
                "INVITED",
                "INVITED",
                List.of(PackageSessionStatusEnum.INVITED.name()),
                List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                List.of(PackageStatusEnum.ACTIVE.name())
        ).orElseThrow(() -> new VacademyException("There is no invited package session"));
    }

    private PackageSession getDefaultPackageSession() {
        return packageSessionRepository.findByPackageIdAndSessionIdAndLevelIdAndStatusIn(
                "INVITED", "INVITED", "INVITED", List.of(PackageSessionStatusEnum.INVITED.name())
        ).orElseThrow(() -> new VacademyException("Default package session not found"));
    }

    private String generateEnrollmentId() {
        return RandomStringUtils.randomNumeric(6);
    }
}
