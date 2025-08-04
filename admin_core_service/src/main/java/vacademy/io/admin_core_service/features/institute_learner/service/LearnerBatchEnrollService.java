package vacademy.io.admin_core_service.features.institute_learner.service;

import org.hibernate.annotations.UuidGenerator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldTypeEnum;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldValueSourceTypeEnum;
import vacademy.io.admin_core_service.features.common.service.CustomFieldValueService;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentExtraDetails;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.live_session.dto.GuestRegistrationRequestDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.common.dto.CustomFieldValueDTO;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class LearnerBatchEnrollService {

    @Autowired
    private InstituteStudentRepository instituteStudentRepository;

    @Autowired
    private StudentRegistrationManager studentRegistrationManager;

    @Autowired
    private CustomFieldValueService customFieldValueService;

    @Autowired
    private StudentSessionRepository studentSessionRepository;

    public UserDTO checkAndCreateStudentAndAddToBatch(UserDTO userDTO, String instituteId, List<InstituteStudentDetails> instituteStudentDetails, List<CustomFieldValueDTO>customFieldValues, Map<String, Object> extraData) {
        UserDTO createdUser = studentRegistrationManager.createUserFromAuthService(userDTO, instituteId);
        Student student = studentRegistrationManager.createStudentFromRequest(createdUser, (extraData.containsKey("studentExtraDetails") ? (StudentExtraDetails) extraData.get("studentExtraDetails") : null));
        for (InstituteStudentDetails instituteStudentDetail : instituteStudentDetails) {
          String studentSessionId =  studentRegistrationManager.linkStudentToInstitute(student, instituteStudentDetail);
          customFieldValueService.addCustomFieldValue(customFieldValues, CustomFieldValueSourceTypeEnum.STUDENT_SESSION_INSTITUTE_GROUP_MAPPING.name(), studentSessionId);
        }
        return createdUser;
    }

    public void shiftLearnerFromInvitedToActivePackageSessions(List<String>packageSessionIds, String userId,String enrollInviteId) {
        List<StudentSessionInstituteGroupMapping>studentSessionInstituteGroupMappings = studentSessionRepository.findByPackageSession_IdInAndUserIdAndStatusIn(
                packageSessionIds,userId,List.of(LearnerStatusEnum.INVITED.name()));

        for (StudentSessionInstituteGroupMapping studentSessionInstituteGroupMapping:studentSessionInstituteGroupMappings){
            if (studentSessionInstituteGroupMapping.getDestinationPackageSession() != null){
                String newSessionId = studentRegistrationManager.shiftStudentBatch(studentSessionInstituteGroupMapping.getDestinationPackageSession().getId(),studentSessionInstituteGroupMapping,LearnerStatusEnum.ACTIVE.name());

                customFieldValueService.shiftCustomField(CustomFieldValueSourceTypeEnum.STUDENT_SESSION_INSTITUTE_GROUP_MAPPING.name(),
                        studentSessionInstituteGroupMapping.getId(),newSessionId, CustomFieldTypeEnum.ENROLL_INVITE.name(),enrollInviteId);
            }
        }
    }
}
