package vacademy.io.assessment_service.features.assessment.service.bulk_entry_services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Service
public class QuestionAssessmentSectionMappingService {

    @Autowired
    private QuestionAssessmentSectionMappingRepository repository;

    public QuestionAssessmentSectionMapping getMappingById(String questionId, String sectionId) {
        return repository.findByQuestionIdAndSectionId(questionId, sectionId).orElse(null);
    }

    public List<QuestionAssessmentSectionMapping> addMultipleMappings(List<QuestionAssessmentSectionMapping> mappings) {
        return StreamSupport.stream(repository.saveAll(mappings).spliterator(), false)
                .collect(Collectors.toList());
    }

    public void softDeleteMappingsByQuestionIdsAndSectionId(List<String> questionIds, String sectionId) {
        repository.hardDeleteByQuestionIdsAndSectionId(questionIds, sectionId);
    }

    public List<QuestionAssessmentSectionMapping> getQuestionAssessmentSectionMappingBySectionIds(List<String> sectionIds) {
        return repository.getQuestionAssessmentSectionMappingBySectionIds(sectionIds);
    }

    public List<QuestionAssessmentSectionMapping> getQuestionAssessmentSectionByAssessment(String assessmentId){
        return repository.getQuestionAssessmentSectionMappingByAssessmentId(assessmentId);
    }
}
