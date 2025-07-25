package vacademy.io.admin_core_service.features.institute_learner.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentExtraDetails;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;
import java.util.Map;

@Service
public class LearnerBatchEnrollService {
    @Autowired
    private InstituteStudentRepository instituteStudentRepository;
    @Autowired
    private StudentRegistrationManager studentRegistrationManager;

    public UserDTO checkAndCreateStudentAndAddToBatch(UserDTO userDTO, String instituteId, List<InstituteStudentDetails> instituteStudentDetails, Map<String, Object> extraData) {
        UserDTO createdUser = studentRegistrationManager.createUserFromAuthService(userDTO, instituteId);
        Student student = studentRegistrationManager.createStudentFromRequest(createdUser, (extraData.containsKey("studentExtraDetails") ? (StudentExtraDetails) extraData.get("studentExtraDetails") : null));
        for (InstituteStudentDetails instituteStudentDetail : instituteStudentDetails) {
            studentRegistrationManager.linkStudentToInstitute(student, instituteStudentDetail);
        }
        return createdUser;
    }
}
