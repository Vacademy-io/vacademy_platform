package vacademy.io.assessment_service.features.assessment.service.section;

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
        List<Object[]> batch = new ArrayList<>();
        for (QuestionAssessmentSectionMapping mapping : mappings) {
            batch.add(new Object[]{
                    UUID.randomUUID().toString(),
                    mapping.getQuestion().getId(),
                    mapping.getAssessment().getId(),
                    mapping.getMarkingJson(),
                    mapping.getSection().getId(),
                    mapping.getQuestionOrder(),
                    mapping.getQuestionDurationInMin(),
                    mapping.getStatus(),
                    new Date(),
                    new Date()
            });
        }
        repository.bulkInsert(batch);
    }

    public void softDeleteMappingsByQuestionIdsAndSectionId(List<String> questionIds, String sectionId) {
        repository.softDeleteByQuestionIdsAndSectionId(questionIds, sectionId);
    }
}
