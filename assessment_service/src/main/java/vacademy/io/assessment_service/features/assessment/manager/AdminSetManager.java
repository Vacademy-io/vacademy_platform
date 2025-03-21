package vacademy.io.assessment_service.features.assessment.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.AssessmentAllSetResponse;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.AssessmentSetDto;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.SetCreateRequest;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentSetMapping;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentSetStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentSetMappingRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Component
public class AdminSetManager {


    @Autowired
    AssessmentRepository assessmentRepository;

    @Autowired
    AssessmentSetMappingRepository assessmentSetMappingRepository;


    public ResponseEntity<String> createAssessmentSet(CustomUserDetails userDetails, String assessmentId, SetCreateRequest request) {

        Optional<Assessment> assessment = assessmentRepository.findById(assessmentId);
        if(assessment.isEmpty()) throw new VacademyException("Assessment Not Found");

        if(Objects.isNull(request)) throw new VacademyException("Invalid Request");
        List<AssessmentSetMapping> setMappings = new ArrayList<>();

        request.getSetRequest().forEach(set->{
            setMappings.add(AssessmentSetMapping.builder()
                    .assessment(assessment.get())
                    .setName(set.getSetName())
                    .status(AssessmentSetStatusEnum.ACTIVE.name())
                    .json(set.getJson())
                    .build());
        });

        assessmentSetMappingRepository.saveAll(setMappings);
        return ResponseEntity.ok("Done");
    }

    public ResponseEntity<AssessmentAllSetResponse> getAllSetsForAssessment(CustomUserDetails userDetails, String assessmentId) {
        return ResponseEntity.ok(createResponseForAllSets(assessmentId));
    }

    private AssessmentAllSetResponse createResponseForAllSets(String assessmentId) {
        List<AssessmentSetDto> assessmentSetDtoList = new ArrayList<>();
        List<AssessmentSetMapping> assessmentSetMappings = assessmentSetMappingRepository.findByAssessmentIdAndStatusNotIn(assessmentId,List.of(AssessmentSetStatusEnum.DELETED.name()));

        assessmentSetMappings.forEach(mapping->{
            assessmentSetDtoList.add(mapping.getSetDto());
        });

        return AssessmentAllSetResponse.builder()
                .allSets(assessmentSetDtoList).build();
    }
}
