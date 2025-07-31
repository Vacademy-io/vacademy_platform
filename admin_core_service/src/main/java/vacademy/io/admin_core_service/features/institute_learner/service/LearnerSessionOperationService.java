package vacademy.io.admin_core_service.features.institute_learner.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.dto.LearnerBatchRegisterRequestDTO;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LearnerSessionOperationService {

    private final StudentSessionRepository studentSessionRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final StudentRegistrationManager studentRegistrationManager;

    @Transactional
    public String addPackageSessionsToLearner(LearnerBatchRegisterRequestDTO requestDTO, CustomUserDetails userDetails) {

        List<StudentSessionInstituteGroupMapping> mappings = requestDTO.getUserIds().stream()
                .flatMap(userId -> createStudentMappings(userId, requestDTO.getInstituteId(), requestDTO.getLearnerBatchRegisterInfos()).stream())
                .collect(Collectors.toList());

        studentSessionRepository.saveAll(mappings);
        return "success";
    }

    private List<StudentSessionInstituteGroupMapping> createStudentMappings(String userId, String instituteId, List<LearnerBatchRegisterRequestDTO.LearnerBatchRegisterInfo> packageSessionDetails) {
        StudentSessionInstituteGroupMapping existingMapping = getStudentSessionMapping(userId, instituteId);

        return packageSessionDetails.stream()
                .map(packageInfo -> buildStudentSessionMapping(userId, packageInfo.getAccessDays(), packageInfo.getPackageSessionId(), existingMapping))
                .collect(Collectors.toList());
    }

    private StudentSessionInstituteGroupMapping buildStudentSessionMapping(String userId, Integer accessDays, String packageSessionId, StudentSessionInstituteGroupMapping existingMapping) {
        PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                .orElseThrow(() -> new VacademyException("Package session not found"));

        StudentSessionInstituteGroupMapping mapping = new StudentSessionInstituteGroupMapping();
        mapping.setUserId(userId);
        mapping.setPackageSession(packageSession);
        mapping.setInstitute(existingMapping.getInstitute());
        mapping.setGroup(existingMapping.getGroup());
        mapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
        mapping.setEnrolledDate(new Date());
        mapping.setInstituteEnrolledNumber(existingMapping.getInstituteEnrolledNumber());
        mapping.setExpiryDate(makeExpiryDate(existingMapping.getEnrolledDate(), accessDays));
        return mapping;
    }

    private StudentSessionInstituteGroupMapping getStudentSessionMapping(String userId, String instituteId) {
        return studentSessionRepository.findByInstituteIdAndUserIdNative(instituteId, userId)
                .orElseThrow(() -> new VacademyException("Student Session not found"));
    }

    private List<PackageSession> fetchPackageSessions(List<LearnerBatchRegisterRequestDTO.LearnerBatchRegisterInfo> packageSessionDetails) {
        List<String> packageSessionIds = packageSessionDetails.stream()
                .map(LearnerBatchRegisterRequestDTO.LearnerBatchRegisterInfo::getPackageSessionId)
                .collect(Collectors.toList());
        return packageSessionRepository.findAllById(packageSessionIds);
    }

    private Date makeExpiryDate(Date enrollmentDate, Integer accessDays) {
        if (enrollmentDate == null || accessDays == null) {
            return null;
        }
        Date expiryDate = new Date(enrollmentDate.getTime() + (long) accessDays * 24 * 60 * 60 * 1000);
        return expiryDate;
    }

    public InstituteStudentDTO reEnrollStudent(CustomUserDetails user, InstituteStudentDTO instituteStudentDTO) {
        Student student = checkAndCreateStudent(instituteStudentDTO);
        createOrUpdateInstituteSessionStudentMapping(student, instituteStudentDTO.getInstituteStudentDetails());
        return instituteStudentDTO;
    }

    private Student checkAndCreateStudent(InstituteStudentDTO instituteStudentDTO) {
        instituteStudentDTO.getUserDetails().setRoles(studentRegistrationManager.getStudentRoles());
        instituteStudentDTO.getUserDetails().setUsername(instituteStudentDTO.getUserDetails().getUsername().toLowerCase());
        UserDTO createdUser = studentRegistrationManager.createUserFromAuthService(instituteStudentDTO.getUserDetails(), instituteStudentDTO.getInstituteStudentDetails().getInstituteId());
        return studentRegistrationManager.createStudentFromRequest(createdUser, instituteStudentDTO.getStudentExtraDetails());
    }

    private void createOrUpdateInstituteSessionStudentMapping(Student student, InstituteStudentDetails instituteStudentDetails) {
        try {
            Optional<StudentSessionInstituteGroupMapping> studentSessionInstituteGroupMappingOptional =
                    studentSessionRepository.findTopByPackageSessionIdAndUserIdAndStatusIn(
                            instituteStudentDetails.getPackageSessionId(),
                            instituteStudentDetails.getInstituteId(),
                            student.getUserId(),
                            List.of(LearnerSessionStatusEnum.ACTIVE.name(),LearnerSessionStatusEnum.INVITED.name(),LearnerSessionStatusEnum.TERMINATED.name(),LearnerSessionStatusEnum.INACTIVE.name())
                    );

            if (studentSessionInstituteGroupMappingOptional.isPresent()) {
                StudentSessionInstituteGroupMapping studentSessionInstituteGroupMapping = studentSessionInstituteGroupMappingOptional.get();
                // Always update enrolledDate to current time
                studentSessionInstituteGroupMapping.setEnrolledDate(new Date());

                // Update only if value is not null
                if (instituteStudentDetails.getEnrollmentStatus() != null) {
                    studentSessionInstituteGroupMapping.setStatus(instituteStudentDetails.getEnrollmentStatus());
                }

                if (instituteStudentDetails.getEnrollmentId() != null) {
                    studentSessionInstituteGroupMapping.setInstituteEnrolledNumber(instituteStudentDetails.getEnrollmentId());
                }

                if (instituteStudentDetails.getAccessDays() != null) {
                    studentSessionInstituteGroupMapping.setExpiryDate(makeExpiryDate(instituteStudentDetails.getEnrollmentDate(), Integer.parseInt(instituteStudentDetails.getAccessDays())));
                }

                studentSessionRepository.save(studentSessionInstituteGroupMapping);
                return;
            }

            UUID studentSessionId = UUID.randomUUID();

            studentSessionRepository.addStudentToInstitute(
                    studentSessionId.toString(),
                    student.getUserId(),
                    instituteStudentDetails.getEnrollmentDate(),
                    instituteStudentDetails.getEnrollmentStatus(),
                    instituteStudentDetails.getEnrollmentId(),
                    instituteStudentDetails.getGroupId(),
                    instituteStudentDetails.getInstituteId(),
                    studentRegistrationManager.makeExpiryDate(instituteStudentDetails.getEnrollmentDate(), instituteStudentDetails.getAccessDays()),
                    instituteStudentDetails.getPackageSessionId(),
                    instituteStudentDetails.getDestinationPackageSessionId()
            );
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

}
