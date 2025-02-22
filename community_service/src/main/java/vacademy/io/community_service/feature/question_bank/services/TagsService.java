package vacademy.io.community_service.feature.question_bank.services;

import org.springframework.stereotype.Service;
import vacademy.io.community_service.feature.filter.repository.EntityTagsRepository;
import vacademy.io.community_service.feature.question_bank.dto.TagsByIdResponseDto;

import java.util.List;

@Service
public class TagsService {

    private final EntityTagsRepository repository;

    public TagsService(EntityTagsRepository repository) {
        this.repository = repository;
    }
    public List<TagsByIdResponseDto> getQuestionPaperTags(String questionPaperId) {
        return repository.findTagsByEntityId(questionPaperId);
    }
}
