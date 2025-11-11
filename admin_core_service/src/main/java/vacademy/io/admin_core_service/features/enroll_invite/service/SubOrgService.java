package vacademy.io.admin_core_service.features.enroll_invite.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.enroll_invite.util.InstituteCustomFieldMapper;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;
import java.util.Optional;

@Service
public class SubOrgService {
    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    public StudentSessionRepository studentSessionRepository;

    public Institute createOrGetSubOrg(List<CustomFieldValueDTO> customFieldValues, String settingJson,String userId,String packageSessionId,String instituteId){
        Institute ex = getExisitingByUserIdAndPackageSessionId(userId,packageSessionId,instituteId);
        if (ex != null){
            return ex;
        }
        Institute subOrg = InstituteCustomFieldMapper.createInstitute(customFieldValues,settingJson);
        subOrg = instituteRepository.save(subOrg);
        return subOrg;
    }

    private Institute getExisitingByUserIdAndPackageSessionId(String userId,String packageSessionId,String instituteId){
        Optional<StudentSessionInstituteGroupMapping> optionalMapping = studentSessionRepository.findTopByPackageSessionIdAndUserIdAndStatusIn(
            packageSessionId,
            instituteId,
            userId,
            List.of(LearnerSessionStatusEnum.ACTIVE.name(),LearnerSessionStatusEnum.INACTIVE.name(),LearnerSessionStatusEnum.TERMINATED.name(),LearnerSessionStatusEnum.INACTIVE.name())
        );
        if (optionalMapping.isPresent()){
            return optionalMapping.get().getSubOrg();
        }
        return null;
    }

    public String getRoles(List<CustomFieldValueDTO>customFieldValueDTOS,String settingJosn){
        return InstituteCustomFieldMapper.determineRolesAsString(customFieldValueDTOS,settingJosn);
    }
}
