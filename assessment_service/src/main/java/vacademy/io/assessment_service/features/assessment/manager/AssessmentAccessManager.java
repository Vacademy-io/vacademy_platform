package vacademy.io.assessment_service.features.assessment.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.util.Pair;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentSaveResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.AddAccessAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentInstituteMapping;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentInstituteMappingRepository;
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

    @Autowired
    AssessmentInstituteMappingRepository assessmentInstituteMappingRepository;

    public ResponseEntity<AssessmentSaveResponseDto> saveAccessToAssessment(CustomUserDetails user, AddAccessAssessmentDetailsDTO addAccessAssessmentDetailsDTO, String assessmentId, String instituteId, String type) {
        Optional<Assessment> assessmentOptional = assessmentService.getAssessmentWithActiveSections(assessmentId, instituteId);
        if (assessmentOptional.isEmpty()) {
            throw new VacademyException("Assessment not found");
        }

        Optional<AssessmentInstituteMapping> assessmentInstituteMappingOptional = getAssessmentInstituteMapping(assessmentOptional.get(), assessmentId, instituteId);
        if (assessmentInstituteMappingOptional.isEmpty())
            return ResponseEntity.ok(new AssessmentSaveResponseDto(assessmentId, assessmentOptional.get().getStatus()));

        if (addAccessAssessmentDetailsDTO.getCurrentAccesses() != null) {

            if (addAccessAssessmentDetailsDTO.getCurrentAccesses().getAssessmentCreationAccess() != null) {
                List<String> currentUserIds = getDetailsFromCommaSeparatedString(assessmentInstituteMappingOptional.get().getCommaSeparatedCreationUserIds());
                List<String> currentRoles = getDetailsFromCommaSeparatedString(assessmentInstituteMappingOptional.get().getCommaSeparatedCreationRoles());
                Pair<List<String>, List<String>> userIdsAndRoles = updateAccessToAssessment(currentUserIds, currentRoles, addAccessAssessmentDetailsDTO.getCurrentAccesses().getAssessmentCreationAccess().getUserIds(), addAccessAssessmentDetailsDTO.getCurrentAccesses().getAssessmentCreationAccess().getRoles());
                assessmentInstituteMappingOptional.get().setCommaSeparatedCreationUserIds(String.join(",", userIdsAndRoles.getFirst()));
                assessmentInstituteMappingOptional.get().setCommaSeparatedCreationRoles(String.join(",", userIdsAndRoles.getSecond()));
            }

            if (addAccessAssessmentDetailsDTO.getCurrentAccesses().getLiveAssessmentNotificationAccess() != null) {
                List<String> currentUserIds = getDetailsFromCommaSeparatedString(assessmentInstituteMappingOptional.get().getCommaSeparatedLiveViewUserIds());
                List<String> currentRoles = getDetailsFromCommaSeparatedString(assessmentInstituteMappingOptional.get().getCommaSeparatedLiveViewRoles());
                Pair<List<String>, List<String>> userIdsAndRoles = updateAccessToAssessment(currentUserIds, currentRoles, addAccessAssessmentDetailsDTO.getCurrentAccesses().getLiveAssessmentNotificationAccess().getUserIds(), addAccessAssessmentDetailsDTO.getCurrentAccesses().getLiveAssessmentNotificationAccess().getRoles());
                assessmentInstituteMappingOptional.get().setCommaSeparatedLiveViewUserIds(String.join(",", userIdsAndRoles.getFirst()));
                assessmentInstituteMappingOptional.get().setCommaSeparatedLiveViewRoles(String.join(",", userIdsAndRoles.getSecond()));
            }

            if (addAccessAssessmentDetailsDTO.getCurrentAccesses().getEvaluationProcessAccess() != null) {
                List<String> currentUserIds = getDetailsFromCommaSeparatedString(assessmentInstituteMappingOptional.get().getCommaSeparatedEvaluationUserIds());
                List<String> currentRoles = getDetailsFromCommaSeparatedString(assessmentInstituteMappingOptional.get().getCommaSeparatedEvaluationRoles());
                Pair<List<String>, List<String>> userIdsAndRoles = updateAccessToAssessment(currentUserIds, currentRoles, addAccessAssessmentDetailsDTO.getCurrentAccesses().getEvaluationProcessAccess().getUserIds(), addAccessAssessmentDetailsDTO.getCurrentAccesses().getEvaluationProcessAccess().getRoles());
                assessmentInstituteMappingOptional.get().setCommaSeparatedEvaluationUserIds(String.join(",", userIdsAndRoles.getFirst()));
                assessmentInstituteMappingOptional.get().setCommaSeparatedEvaluationRoles(String.join(",", userIdsAndRoles.getSecond()));
            }

            if (addAccessAssessmentDetailsDTO.getCurrentAccesses().getAssessmentSubmissionAndReportAccess() != null) {
                List<String> currentUserIds = getDetailsFromCommaSeparatedString(assessmentInstituteMappingOptional.get().getCommaSeparatedSubmissionViewUserIds());
                List<String> currentRoles = getDetailsFromCommaSeparatedString(assessmentInstituteMappingOptional.get().getCommaSeparatedSubmissionViewRoles());
                Pair<List<String>, List<String>> userIdsAndRoles = updateAccessToAssessment(currentUserIds, currentRoles, addAccessAssessmentDetailsDTO.getCurrentAccesses().getAssessmentSubmissionAndReportAccess().getUserIds(), addAccessAssessmentDetailsDTO.getCurrentAccesses().getAssessmentSubmissionAndReportAccess().getRoles());
                assessmentInstituteMappingOptional.get().setCommaSeparatedSubmissionViewUserIds(String.join(",", userIdsAndRoles.getFirst()));
                assessmentInstituteMappingOptional.get().setCommaSeparatedSubmissionViewRoles(String.join(",", userIdsAndRoles.getSecond()));
            }

            assessmentInstituteMappingRepository.save(assessmentInstituteMappingOptional.get());

        }

        return ResponseEntity.ok(new AssessmentSaveResponseDto(assessmentId, assessmentOptional.get().getStatus()));

    }

    private Optional<AssessmentInstituteMapping> getAssessmentInstituteMapping(Assessment assessment, String assessmentId, String instituteId) {
        return assessment.getAssessmentInstituteMappings().stream().filter((am) -> am.getAssessment().getId().equals(assessmentId) && am.getInstituteId().equals(instituteId)).findFirst();
    }

    private List<String> getDetailsFromCommaSeparatedString(String value) {
        if (!StringUtils.hasText(value)) return List.of();
        return List.of(value.split(","));
    }

    Pair<List<String>, List<String>> updateAccessToAssessment(List<String> currentUserIds, List<String> currentRoles, List<String> newUserIds, List<String> newRoles) {
        if(newUserIds.isEmpty()) newUserIds = List.of();
        if(newRoles.isEmpty()) newRoles = List.of();

        Set<String> userIds = new HashSet<>(newUserIds);

        newUserIds = userIds.stream().toList();
        Set<String> roles = new HashSet<>(newRoles);

        newRoles = roles.stream().toList();
        return Pair.of(newUserIds, newRoles);
    }

    Pair<List<String>, List<String>> deleteAccessToAssessment(List<String> currentUserIds, List<String> currentRoles, List<String> toBeDeletedUserIds, List<String> toBeDeletedRoles) {
        if (toBeDeletedUserIds.isEmpty()) toBeDeletedUserIds = List.of();
        if (toBeDeletedRoles.isEmpty()) toBeDeletedRoles = List.of();

        Set<String> userIds = new HashSet<>(currentUserIds);
        toBeDeletedUserIds.forEach(userIds::remove);
        Set<String> roles = new HashSet<>(currentRoles);
        toBeDeletedRoles.forEach(roles::remove);
        return Pair.of(userIds.stream().toList(), roles.stream().toList());
    }
}
