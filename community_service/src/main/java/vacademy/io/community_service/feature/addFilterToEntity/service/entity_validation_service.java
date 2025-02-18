package vacademy.io.community_service.feature.addFilterToEntity.service;


import org.springframework.stereotype.Service;
import vacademy.io.community_service.feature.addFilterToEntity.repository.question_paper_repository;
import vacademy.io.community_service.feature.addFilterToEntity.repository.question_repository;
import vacademy.io.community_service.feature.addFilterToEntity.enums.entity_name;

@Service
public class entity_validation_service {
    private final question_repository questionRepository;
    private final question_paper_repository questionPaperRepository;

    public entity_validation_service(question_repository questionRepository, question_paper_repository questionPaperRepository) {
        this.questionRepository = questionRepository;
        this.questionPaperRepository = questionPaperRepository;
    }

    public boolean validateEntity(String entityName, String entityId) {
        return switch (entity_name.valueOf(entityName.toUpperCase())) {
            case QUESTION -> questionRepository.existsById(entityId);
            case QUESTION_PAPER -> questionPaperRepository.existsById(entityId);
            default -> true;
        };
    }
}
