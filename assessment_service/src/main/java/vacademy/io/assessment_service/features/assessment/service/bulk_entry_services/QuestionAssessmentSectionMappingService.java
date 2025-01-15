package vacademy.io.assessment_service.features.assessment.service.bulk_entry_services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@Service
public class QuestionAssessmentSectionMappingService {

    @Autowired
    private QuestionAssessmentSectionMappingRepository repository;

    public void addMultipleMappings(List<QuestionAssessmentSectionMapping> mappings) {
        repository.saveAll(mappings);
    }

    public void softDeleteMappingsByQuestionIdsAndSectionId(List<String> questionIds, String sectionId) {
        repository.softDeleteByQuestionIdsAndSectionId(questionIds, sectionId);
    }

    public List<QuestionAssessmentSectionMapping> getQuestionAssessmentSectionMappingBySectionIds(List<String> sectionIds) {
        return repository.getQuestionAssessmentSectionMappingBySectionIds(sectionIds);
    }
}
