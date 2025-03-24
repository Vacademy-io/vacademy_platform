package vacademy.io.admin_core_service.features.institute_learner.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.dto.LearnerBatchRegisterDTO;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;

@Service
public class LearnerSessionOperationService {

    @Autowired
    private StudentSessionRepository studentSessionRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Transactional
    public String addPackageSessionsToLearner(LearnerBatchRegisterDTO learnerBatchRegisterDTO, CustomUserDetails customUserDetails) {
        List<String> packageSessionIds = getPackageSessionIds(learnerBatchRegisterDTO.getCommaSeparatedPackageSessionIds());
        List<StudentSessionInstituteGroupMapping>mappings = new ArrayList<>();
        StudentSessionInstituteGroupMapping studentSessionInstituteGroupMapping = new StudentSessionInstituteGroupMapping();
        for(String packageSessionId : packageSessionIds) {
            StudentSessionInstituteGroupMapping existingMapping = getStudentSessionInstituteMappingByUserIdAndInstituteId(learnerBatchRegisterDTO.getUserId(),learnerBatchRegisterDTO.getInstituteId());
            PackageSession packageSession = packageSessionRepository.findById(packageSessionId).orElseThrow(() -> new VacademyException("Package Session not found"));
            studentSessionInstituteGroupMapping.setUserId(learnerBatchRegisterDTO.getUserId());
            studentSessionInstituteGroupMapping.setPackageSession(packageSession);
            studentSessionInstituteGroupMapping.setInstitute(existingMapping.getInstitute());
            studentSessionInstituteGroupMapping.setGroup(existingMapping.getGroup());
            studentSessionInstituteGroupMapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
            studentSessionInstituteGroupMapping.setEnrolledDate(new Date());
            studentSessionInstituteGroupMapping.setInstituteEnrolledNumber(existingMapping.getInstituteEnrolledNumber());
//            studentSessionInstituteGroupMapping.set
            mappings.add(studentSessionInstituteGroupMapping);
        }
        studentSessionRepository.saveAll(mappings);
        return "success";
    }

    public StudentSessionInstituteGroupMapping getStudentSessionInstituteMappingByUserIdAndInstituteId(String userId,String instituteId){
        return studentSessionRepository.findByInstituteIdAndUserIdNative(instituteId,userId).orElseThrow(() -> new VacademyException("Student Session not found"));
    }

    private List<String> getPackageSessionIds(String packageSessionIds) {
        return Arrays.stream(packageSessionIds.trim().split(",")).toList();
    }
}
