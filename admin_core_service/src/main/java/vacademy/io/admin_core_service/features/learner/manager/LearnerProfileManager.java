package vacademy.io.admin_core_service.features.learner.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner.dto.LearnerBatchDetail;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.LevelDTO;
import vacademy.io.common.institute.dto.PackageDTO;
import vacademy.io.common.institute.dto.SessionDTO;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Component
public class LearnerProfileManager {

    @Autowired
    InstituteStudentRepository instituteStudentRepository;

    @Autowired
    StudentSessionRepository studentSessionRepository;

    public ResponseEntity<List<StudentDTO>> getLearnerInfo(CustomUserDetails user, String instituteId) {
        List<Object[]> optionalEntry = instituteStudentRepository.getStudentWithInstituteAndUserId(user.getUserId(), instituteId);

        if (optionalEntry.isEmpty()) {
            Optional<Student> student = instituteStudentRepository.findTopByUserId(user.getUserId());
            if (student.isEmpty()) {
                throw new VacademyException("User not found");
            }
            return ResponseEntity.status(201).body(Collections.singletonList(new StudentDTO(student.get())));
        }
        List<StudentDTO> studentDTOS = new ArrayList<>();
        for (Object[] objects : optionalEntry) {
            studentDTOS.add(new StudentDTO(objects));
        }

        return ResponseEntity.ok(studentDTOS);
    }

    public LearnerBatchDetail getLearnerBatchDetail(CustomUserDetails userDetails,String packageSessionId,String instituteId){
        StudentSessionInstituteGroupMapping studentSessionInstituteGroupMapping = studentSessionRepository.findTopByPackageSessionIdAndUserIdAndStatusIn(packageSessionId,instituteId,userDetails.getUserId(),List.of(LearnerStatusEnum.ACTIVE.name()))
                .orElseThrow(()->new VacademyException("User not found for given package session"));
        LearnerBatchDetail learnerBatchDetail = new LearnerBatchDetail();
        learnerBatchDetail.setEnrollMentDate(studentSessionInstituteGroupMapping.getEnrolledDate());
        learnerBatchDetail.setExpiryDate(studentSessionInstituteGroupMapping.getExpiryDate());
        learnerBatchDetail.setGetEnrollmentNumber(studentSessionInstituteGroupMapping.getInstituteEnrolledNumber());
        learnerBatchDetail.setLevel(new LevelDTO(studentSessionInstituteGroupMapping.getPackageSession().getLevel()));
        learnerBatchDetail.setPackageDetails(new PackageDTO(studentSessionInstituteGroupMapping.getPackageSession().getPackageEntity()));
        learnerBatchDetail.setSession(new SessionDTO(studentSessionInstituteGroupMapping.getPackageSession().getSession()));
        return learnerBatchDetail;
    }

}
