package vacademy.io.admin_core_service.features.learner.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.learner.dto.LearnerPaymentPlanStatusDTO;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Optional;

@Service
public class LearnerUserPlanService {

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private StudentSessionInstituteGroupMappingRepository studentSessionInstituteGroupMappingRepository;

    @Autowired
    private UserPlanService userPlanService;

    public LearnerPaymentPlanStatusDTO getUserPaymentPlanStatus(String packageSessionId, CustomUserDetails userDetails) {
        Optional<StudentSessionInstituteGroupMapping>optionalStudentSessionInstituteGroupMapping = studentSessionInstituteGroupMappingRepository.findLatestByDestinationPackageSessionIdAndStatusInAndUserId(packageSessionId,List.of(LearnerStatusEnum.INVITED.name(),LearnerStatusEnum.PENDING_FOR_APPROVAL.name()),userDetails.getUserId());
        if (optionalStudentSessionInstituteGroupMapping.isEmpty()){
            throw new VacademyException("Student has not submitted the request to enroll.");
        }
        UserPlan userPlan = userPlanService.findById(optionalStudentSessionInstituteGroupMapping.get().getUserPlanId());
        return new LearnerPaymentPlanStatusDTO(userPlan.getStatus(),optionalStudentSessionInstituteGroupMapping.get().getStatus());
    }
}
