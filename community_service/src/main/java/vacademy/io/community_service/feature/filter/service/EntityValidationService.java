package vacademy.io.community_service.feature.filter.service;


import org.springframework.stereotype.Service;
import vacademy.io.community_service.feature.filter.repository.QuestionPaperRepository;
import vacademy.io.community_service.feature.filter.repository.QuestionRepository;
import vacademy.io.community_service.feature.filter.enums.EntityName;

@Service
public class EntityValidationService {
    private final QuestionRepository questionRepository;
    private final QuestionPaperRepository questionPaperRepository;

    public EntityValidationService(QuestionRepository questionRepository, QuestionPaperRepository questionPaperRepository) {
        this.questionRepository = questionRepository;
        this.questionPaperRepository = questionPaperRepository;
    }

    public boolean validateEntity(String entityName, String entityId) {
        return switch (EntityName.valueOf(entityName.toUpperCase())) {
            case QUESTION -> questionRepository.existsById(entityId);
            case QUESTION_PAPER -> questionPaperRepository.existsById(entityId);
            default -> true;
        };
    }
}
