package vacademy.io.admin_core_service.features.learner.manager;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.InstituteModuleService;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner.dto.StudentInstituteInfoDTO;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.*;

@Component
public class LearnerProfileManager {

    @Autowired
    InstituteStudentRepository instituteStudentRepository;

    public List<StudentDTO> getLearnerInfo(CustomUserDetails user, String instituteId) {
        List<Object[]> optionalEntry = instituteStudentRepository.getStudentWithInstituteAndUserId(user.getUserId(), instituteId);

        if (optionalEntry.isEmpty()) {
            throw new VacademyException("No user found with id " + user.getId());
        }
        List<StudentDTO> studentDTOS = new ArrayList<>();
        for (Object[] objects : optionalEntry) {
            studentDTOS.add(new StudentDTO(objects));
        }

        return studentDTOS;
    }
}
