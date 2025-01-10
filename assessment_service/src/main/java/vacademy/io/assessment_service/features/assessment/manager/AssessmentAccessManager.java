package vacademy.io.assessment_service.features.assessment.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.util.Pair;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentSaveResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.BatchesAndUsersDto;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.AddAccessAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentInstituteMapping;
import vacademy.io.assessment_service.features.assessment.service.assessment_get.AssessmentService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Component
public class AssessmentAccessManager {

    @Autowired
    AssessmentService assessmentService;

    public ResponseEntity<AssessmentSaveResponseDto> saveAccessToAssessment(CustomUserDetails user, AddAccessAssessmentDetailsDTO addAccessAssessmentDetailsDTO, String assessmentId, String instituteId, String type) {
        Optional<Assessment> assessmentOptional = assessmentService.getAssessmentWithActiveSections(assessmentId, instituteId);
        if (assessmentOptional.isEmpty()) {
            throw new VacademyException("Assessment not found");
        }

        Optional<AssessmentInstituteMapping> assessmentInstituteMappingOptional = getAssessmentInstituteMapping(assessmentOptional.get(), assessmentId, instituteId);
        if (assessmentInstituteMappingOptional.isEmpty())
            return ResponseEntity.ok(new AssessmentSaveResponseDto(assessmentId, assessmentOptional.get().getStatus()));

        if(addAccessAssessmentDetailsDTO.getAddedAccesses()!=null) {

            if(addAccessAssessmentDetailsDTO.getAddedAccesses().getAssessmentCreationAccess() != null) {

            }

        }

        return ResponseEntity.ok(new AssessmentSaveResponseDto(assessmentId, assessmentOptional.get().getStatus()));

    }

    private Optional<AssessmentInstituteMapping> getAssessmentInstituteMapping(Assessment assessment, String assessmentId, String instituteId) {
        return assessment.getAssessmentInstituteMappings().stream().filter((am) -> am.getAssessment().getId().equals(assessmentId) && am.getInstituteId().equals(instituteId)).findFirst();
    }

    private List<String> getDetailsFromCommaSeparatedString(String value){
        if(!StringUtils.hasText(value)) return List.of();
        return List.of(value.split(","));
    }

    Pair<List<String>, List<String>> updateAccessToAssessment(BatchesAndUsersDto addAccessAssessmentDetailsDTO, List<String> currentUserIds, List<String> currentEmailIds, List<String> newUserIds, List<String> newEmailIds) {
        Set<String> userIds = new HashSet<>(currentUserIds);
        userIds.addAll(newUserIds);
        newUserIds = userIds.stream().toList();
        Set<String> emailIds = new HashSet<>(currentEmailIds);
        emailIds.addAll(newEmailIds);
        newEmailIds = emailIds.stream().toList();
        return Pair.of(newUserIds, newEmailIds);
    }

    Pair<List<String>, List<String>> deleteAccessToAssessment(BatchesAndUsersDto addAccessAssessmentDetailsDTO, List<String> currentUserIds, List<String> currentEmailIds, List<String> toBeDeletedUserIds, List<String> toBeDeletedEmailIds) {
        Set<String> userIds = new HashSet<>(currentUserIds);
        toBeDeletedUserIds.forEach(userIds::remove);
        Set<String> emailIds = new HashSet<>(currentEmailIds);
        toBeDeletedEmailIds.forEach(emailIds::remove);
        return Pair.of(userIds.stream().toList(), emailIds.stream().toList());
    }
}
