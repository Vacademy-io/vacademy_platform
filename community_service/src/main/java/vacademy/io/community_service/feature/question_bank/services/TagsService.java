package vacademy.io.community_service.feature.question_bank.services;

import org.springframework.stereotype.Service;
import vacademy.io.community_service.feature.filter.entity.QuestionPaper;
import vacademy.io.community_service.feature.filter.repository.EntityTagsRepository;
import vacademy.io.community_service.feature.question_bank.dto.TagsByIdResponseDto;
import vacademy.io.community_service.feature.question_bank.dto.TagsWithQuestionPaperResponseDto;

import java.util.List;

@Service
public class TagsService {

    private final EntityTagsRepository repository;

    public TagsService(EntityTagsRepository repository) {
        this.repository = repository;
    }
    public TagsWithQuestionPaperResponseDto getQuestionPaperTags(String entityId) {
        // Fetch the question paper details
        QuestionPaper questionPaper = repository.findQuestionPaperByEntityId(entityId);

        // Fetch the tags related to the question paper
        List<TagsByIdResponseDto> tags = repository.findTagsByEntityId(entityId);

        // Wrap and return response
        return TagsWithQuestionPaperResponseDto.builder()
                .questionPaper(questionPaper)
                .tags(tags)
                .build();
    }
}
