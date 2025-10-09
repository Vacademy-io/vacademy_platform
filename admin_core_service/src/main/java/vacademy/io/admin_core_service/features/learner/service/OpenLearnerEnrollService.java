package vacademy.io.admin_core_service.features.learner.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldValueSourceTypeEnum;
import vacademy.io.admin_core_service.features.common.service.CustomFieldValueService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.learner.dto.OpenLearnerEnrollRequestDTO;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
public class OpenLearnerEnrollService {

    private static final String INVITED_STATUS = "INVITED";

    @Autowired
    private AuthService authService;

    @Autowired
    private StudentSessionInstituteGroupMappingRepository mappingRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private InstituteSettingService instituteSettingService;

    @Autowired
    private InstituteStudentRepository instituteStudentRepository;

    @Autowired
    private CustomFieldValueService customFieldValueService;

    @Transactional
    public String enrollUserInPackageSession(OpenLearnerEnrollRequestDTO requestDTO, String instituteId) {
        UserDTO user = createOrFetchUser(requestDTO, instituteId);
        PackageSession packageSession = resolvePackageSession(requestDTO, instituteId);
        ensureStudentExists(user);
        validateMapping(requestDTO, user);
        StudentSessionInstituteGroupMapping mapping = buildMapping(requestDTO, user, packageSession, instituteId);
        mapping = mappingRepository.save(mapping);
        if (requestDTO.getCustomFieldValues() != null) {
            customFieldValueService.addCustomFieldValue(requestDTO.getCustomFieldValues(),
                    CustomFieldValueSourceTypeEnum.STUDENT_SESSION_INSTITUTE_GROUP_MAPPING.name(), mapping.getId());
        }
        return "Success";
    }

    private UserDTO createOrFetchUser(OpenLearnerEnrollRequestDTO requestDTO, String instituteId) {
        if (!StringUtils.hasText(requestDTO.getUserDTO().getFullName())) {
            throw new VacademyException("Full name required!!!");
        }
        return authService.createUserFromAuthService(requestDTO.getUserDTO(), instituteId, false);
    }

    private PackageSession resolvePackageSession(OpenLearnerEnrollRequestDTO requestDTO, String instituteId) {
        // Priority 1: Use packageSessionId from payload if provided
        if (StringUtils.hasText(requestDTO.getPackageSessionId())) {
            try {
                return getInvitedPackageSession(requestDTO.getPackageSessionId());
            } catch (VacademyException e) {
                // If the provided package session is not found, continue to fallback
                log.warn("Package session {} not found, trying fallback: {}", requestDTO.getPackageSessionId(),
                        e.getMessage());
            }
        }

        // Priority 2: Get default_package_id from institute settings
        try {
            String defaultPackageId = getDefaultPackageIdFromInstituteSettings(instituteId);
            requestDTO.setDesiredPackageId(defaultPackageId);
            if (StringUtils.hasText(defaultPackageId)) {
                return getInvitedPackageSessionByPackageId(defaultPackageId);
            }
        } catch (VacademyException e) {
            log.warn("Default package session not found in institute settings: {}", e.getMessage());
        }

        // Priority 3: Throw error if no package session can be resolved
        throw new VacademyException(
                "No valid package session found. Please provide a valid packageSessionId or configure default_package_id in institute settings.");
    }

    private String getDefaultPackageIdFromInstituteSettings(String instituteId) {
        try {
            Institute institute = instituteRepository.findById(instituteId)
                    .orElseThrow(() -> new VacademyException("Institute not found with ID: " + instituteId));

            Object settingData = instituteSettingService.getSettingData(institute, "OPEN_INVITE_SETTING");
            if (settingData == null) {
                throw new VacademyException("OPEN_INVITE_SETTING not found in institute settings");
            }

            // Convert the setting data to a Map to access default_package_id
            if (settingData instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> dataMap = (Map<String, Object>) settingData;
                Object defaultPackageId = dataMap.get("default_package_id");
                if (defaultPackageId != null) {
                    return defaultPackageId.toString();
                }
            }

            throw new VacademyException("default_package_id not found in OPEN_INVITE_SETTING");
        } catch (Exception e) {
            throw new VacademyException(
                    "Error retrieving default package ID from institute settings: " + e.getMessage());
        }
    }

    private void ensureStudentExists(UserDTO user) {
        Optional<Student> studentOpt = instituteStudentRepository.findTopByUserIdOrderByCreatedAtDesc(user.getId());
        if (studentOpt.isEmpty()) {
            Student student = new Student(user);
            instituteStudentRepository.save(student);
        }
    }

    private void validateMapping(OpenLearnerEnrollRequestDTO requestDTO, UserDTO user) {
        String source = requestDTO.getSource();
        String type = requestDTO.getType();
        String typeId = requestDTO.getTypeId();

        String userId = user.getId();

        Optional<StudentSessionInstituteGroupMapping> mapping = Optional.empty();

        if (StringUtils.hasText(source) && StringUtils.hasText(type) && StringUtils.hasText(typeId)) {
            mapping = mappingRepository.findBySourceAndTypeIdAndTypeAndUserIdAndStatus(
                    source, typeId, type, userId, INVITED_STATUS);
        } else if (StringUtils.hasText(source) && StringUtils.hasText(type)) {
            mapping = mappingRepository.findBySourceAndTypeAndUserIdAndStatus(
                    source, type, userId, INVITED_STATUS);
        } else if (StringUtils.hasText(source) && StringUtils.hasText(typeId)) {
            mapping = mappingRepository.findBySourceAndTypeIdAndUserIdAndStatus(
                    source, typeId, userId, INVITED_STATUS);
        } else if (StringUtils.hasText(type) && StringUtils.hasText(typeId)) {
            mapping = mappingRepository.findByTypeAndTypeIdAndUserIdAndStatus(
                    type, typeId, userId, INVITED_STATUS);
        } else if (StringUtils.hasText(source)) {
            mapping = mappingRepository.findBySourceAndUserIdAndStatus(
                    source, userId, INVITED_STATUS);
        } else if (StringUtils.hasText(type)) {
            mapping = mappingRepository.findByTypeAndUserIdAndStatus(
                    type, userId, INVITED_STATUS);
        } else if (StringUtils.hasText(typeId)) {
            mapping = mappingRepository.findByTypeIdAndUserIdAndStatus(
                    typeId, userId, INVITED_STATUS);
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
        mapping.setStatus(INVITED_STATUS);
        mapping.setPackageSession(packageSession);
        mapping.setUserId(user.getId());
        mapping.setEnrolledDate(new Date());
        mapping.setInstitute(instituteRepository.findById(instituteId).orElseThrow());
        if (StringUtils.hasText(requestDTO.getPackageSessionId())) {
            mapping.setDestinationPackageSession(
                    packageSessionRepository.findById(requestDTO.getPackageSessionId()).orElseThrow());
        }
        mapping.setDesiredLevelId(requestDTO.getDesiredLevelId());
        mapping.setDesiredPackageId(requestDTO.getDesiredPackageId());
        return mapping;
    }

    private PackageSession getInvitedPackageSession(String packageSessionId) {
        return packageSessionRepository.findInvitedPackageSessionForPackage(
                packageSessionId,
                INVITED_STATUS,
                INVITED_STATUS,
                List.of(INVITED_STATUS),
                List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                List.of(PackageStatusEnum.ACTIVE.name()))
                .orElseThrow(() -> new VacademyException("There is no invited package session"));
    }

    private PackageSession getInvitedPackageSessionByPackageId(String packageId) {
        return packageSessionRepository.findByPackageEntity_IdAndLevel_IdAndSession_IdAndStatusIn(
                packageId,
                INVITED_STATUS,
                INVITED_STATUS,
                List.of(INVITED_STATUS))
                .orElseThrow(() -> new VacademyException("There is no invited package session"));
    }
}
