package vacademy.io.admin_core_service.features.learner.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.learner.dto.LearnerDetailsDTO;
import vacademy.io.admin_core_service.features.learner.dto.LearnerDetailsEditDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class LearnerService {
    @Autowired
    private InstituteStudentRepository instituteStudentRepository;

    public String editLearnerDetails(LearnerDetailsEditDTO learnerDetailsEditDTO, CustomUserDetails user) {
        if (Objects.isNull(learnerDetailsEditDTO)) {
            throw new VacademyException("Invalid request");
        }
        Student student = instituteStudentRepository.findTopByUserId(learnerDetailsEditDTO.getUserId()).orElseThrow(() -> new VacademyException("User not found"));
        if (StringUtils.hasText(learnerDetailsEditDTO.getEmail())) student.setEmail(learnerDetailsEditDTO.getEmail());
        if (StringUtils.hasText(learnerDetailsEditDTO.getFullName()))
            student.setFullName(learnerDetailsEditDTO.getFullName());
        if (StringUtils.hasText(learnerDetailsEditDTO.getContactNumber()))
            student.setMobileNumber(learnerDetailsEditDTO.getContactNumber());
        if (StringUtils.hasText(learnerDetailsEditDTO.getGender()))
            student.setGender(learnerDetailsEditDTO.getGender());
        if (StringUtils.hasText(learnerDetailsEditDTO.getAddressLine()))
            student.setAddressLine(learnerDetailsEditDTO.getAddressLine());
        if (StringUtils.hasText(learnerDetailsEditDTO.getState())) student.setRegion(learnerDetailsEditDTO.getState());
        if (StringUtils.hasText(learnerDetailsEditDTO.getPinCode()))
            student.setPinCode(learnerDetailsEditDTO.getPinCode());
        if (StringUtils.hasText(learnerDetailsEditDTO.getInstituteName()))
            student.setLinkedInstituteName(learnerDetailsEditDTO.getInstituteName());
        if (StringUtils.hasText(learnerDetailsEditDTO.getFatherName()))
            student.setFatherName(learnerDetailsEditDTO.getFatherName());
        if (StringUtils.hasText(learnerDetailsEditDTO.getMotherName()))
            student.setMotherName(learnerDetailsEditDTO.getMotherName());
        if (StringUtils.hasText(learnerDetailsEditDTO.getParentsMobileNumber()))
            student.setParentToMotherMobileNumber(learnerDetailsEditDTO.getParentsMobileNumber());
        if (StringUtils.hasText(learnerDetailsEditDTO.getParentsEmail()))
            student.setParentsEmail(learnerDetailsEditDTO.getParentsEmail());
        if (StringUtils.hasText(learnerDetailsEditDTO.getFaceFileId()))
            student.setFaceFileId(learnerDetailsEditDTO.getFaceFileId());
        instituteStudentRepository.save(student);
        return "success";
    }

    public String updateFaceFileId(String faceFileId, CustomUserDetails userDetails) {
        if (StringUtils.hasText(userDetails.getId()) && StringUtils.hasText(faceFileId)) {
            Student student = instituteStudentRepository.findTopByUserId(userDetails.getId()).orElseThrow(() -> new VacademyException("User not found"));
            student.setFaceFileId(faceFileId);
            instituteStudentRepository.save(student);
            return "success";
        }
        return "failed";
    }

    public List<LearnerDetailsDTO> getStudentsByPackageSessionId(String packageSessionId, String instituteId, CustomUserDetails user) {
        return instituteStudentRepository.findStudentsByPackageSessionIdAndInstituteIdAndStatus(packageSessionId, instituteId, List.of(LearnerStatusEnum.ACTIVE.name())).stream()
                .map(student -> new LearnerDetailsDTO(student.getFullName(), student.getUserId())).collect(Collectors.toList());
    }
}
