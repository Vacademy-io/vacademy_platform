package vacademy.io.admin_core_service.features.learner.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.learner.dto.LearnerDetailsDTO;
import vacademy.io.admin_core_service.features.learner.dto.LearnerDetailsEditDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class LearnerService {
    @Autowired
    private InstituteStudentRepository instituteStudentRepository;

    @Autowired
    private AuthService authService;

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
        if (StringUtils.hasText(learnerDetailsEditDTO.getUserName())){
            student.setUsername(learnerDetailsEditDTO.getUserName());
        }
        student.setFaceFileId(learnerDetailsEditDTO.getFaceFileId());
        instituteStudentRepository.save(student);
        UserDTO userDTO = new UserDTO();
        userDTO.setId(learnerDetailsEditDTO.getUserId());
        userDTO.setFullName(learnerDetailsEditDTO.getFullName());
        userDTO.setEmail(learnerDetailsEditDTO.getEmail());
        userDTO.setMobileNumber(learnerDetailsEditDTO.getContactNumber());
        userDTO.setProfilePicFileId(learnerDetailsEditDTO.getFaceFileId());
        userDTO.setUsername(learnerDetailsEditDTO.getUserName());
        authService.updateUser(userDTO, learnerDetailsEditDTO.getUserId());
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


    public String updateLearnerDetail(UserDTO userDTO,LearnerExtraDetails learnerExtraDetails) {
        Student student = instituteStudentRepository.findTopByUserId(userDTO.getId())
                .orElseThrow(() -> new VacademyException("User not found"));

        student.setUsername(userDTO.getUsername());
        student.setFullName(userDTO.getFullName());
        student.setAddressLine(userDTO.getAddressLine());
        student.setRegion(userDTO.getRegion());
        student.setCity(userDTO.getCity());
        student.setPinCode(userDTO.getPinCode());
        student.setMobileNumber(userDTO.getMobileNumber());
        student.setDateOfBirth(userDTO.getDateOfBirth());
        student.setGender(userDTO.getGender());
        student.setFatherName(learnerExtraDetails.getFathersName());
        student.setMotherName(learnerExtraDetails.getMothersName());
        student.setParentsMobileNumber(learnerExtraDetails.getParentsMobileNumber());
        student.setParentsEmail(learnerExtraDetails.getParentsEmail());
        student.setLinkedInstituteName(learnerExtraDetails.getLinkedInstituteName());
        student.setParentsToMotherEmail(learnerExtraDetails.getParentsToMotherEmail());
        student.setParentToMotherMobileNumber(learnerExtraDetails.getParentsToMotherMobileNumber());
       student.setFaceFileId(userDTO.getProfilePicFileId());

        instituteStudentRepository.save(student);
        return "done";
    }

    public String updateLearnerDetail(UserDTO userDTO) {
        Student student = instituteStudentRepository.findTopByUserId(userDTO.getId())
                .orElseThrow(() -> new VacademyException("User not found"));

        if (StringUtils.hasText(userDTO.getUsername())) {
            student.setUsername(userDTO.getUsername());
        }
        if (StringUtils.hasText(userDTO.getEmail())) {
            student.setEmail(userDTO.getEmail());
        }
        if (StringUtils.hasText(userDTO.getFullName())) {
            student.setFullName(userDTO.getFullName());
        }
        if (StringUtils.hasText(userDTO.getAddressLine())) {
            student.setAddressLine(userDTO.getAddressLine());
        }
        if (StringUtils.hasText(userDTO.getRegion())) {
            student.setRegion(userDTO.getRegion());
        }
        if (StringUtils.hasText(userDTO.getCity())) {
            student.setCity(userDTO.getCity());
        }
        if (StringUtils.hasText(userDTO.getPinCode())) {
            student.setPinCode(userDTO.getPinCode());
        }
        if (StringUtils.hasText(userDTO.getMobileNumber())) {
            student.setMobileNumber(userDTO.getMobileNumber());
        }
        if (userDTO.getDateOfBirth() != null) {
            student.setDateOfBirth(userDTO.getDateOfBirth());
        }
        if (StringUtils.hasText(userDTO.getGender())) {
            student.setGender(userDTO.getGender());
        }
        if (StringUtils.hasText(userDTO.getProfilePicFileId())) {
            student.setFaceFileId(userDTO.getProfilePicFileId());
        }
        instituteStudentRepository.save(student);
        return "done";
    }

    public void updateLearnerExtraDetails(LearnerExtraDetails learnerExtraDetails, String userId) {
        if (learnerExtraDetails == null || !StringUtils.hasText(userId)) {
            return;
        }

        Student student = instituteStudentRepository.findTopByUserId(userId)
                .orElseThrow(() -> new VacademyException("User not found"));

        if (StringUtils.hasText(learnerExtraDetails.getFathersName())) {
            student.setFatherName(learnerExtraDetails.getFathersName());
        }
        if (StringUtils.hasText(learnerExtraDetails.getMothersName())) {
            student.setMotherName(learnerExtraDetails.getMothersName());
        }
        if (StringUtils.hasText(learnerExtraDetails.getParentsMobileNumber())) {
            student.setParentsMobileNumber(learnerExtraDetails.getParentsMobileNumber());
        }
        if (StringUtils.hasText(learnerExtraDetails.getParentsEmail())) {
            student.setParentsEmail(learnerExtraDetails.getParentsEmail());
        }
        if (StringUtils.hasText(learnerExtraDetails.getLinkedInstituteName())) {
            student.setLinkedInstituteName(learnerExtraDetails.getLinkedInstituteName());
        }
        if (StringUtils.hasText(learnerExtraDetails.getParentsToMotherEmail())) {
            student.setParentsToMotherEmail(learnerExtraDetails.getParentsToMotherEmail());
        }
        if (StringUtils.hasText(learnerExtraDetails.getParentsToMotherMobileNumber())) {
            student.setParentToMotherMobileNumber(learnerExtraDetails.getParentsToMotherMobileNumber());
        }

        instituteStudentRepository.save(student);
    }
}
