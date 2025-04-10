package vacademy.io.community_service.feature.question_bank.services;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.community_service.feature.filter.repository.EntityTagsRepository;
import vacademy.io.community_service.feature.filter.repository.QuestionPaperRepository;
import vacademy.io.community_service.feature.presentation.repository.QuestionRepository;
import vacademy.io.community_service.feature.question_bank.dto.FilteredEntityResponseDto;
import vacademy.io.community_service.feature.question_bank.dto.RequestDto;
import vacademy.io.community_service.feature.question_bank.dto.TagFilterRequestDto;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class FilterEntityService {

    private final EntityTagsRepository repository;
    private final QuestionRepository questionRepository;
    private final QuestionPaperRepository questionPaperRepository;

    public FilterEntityService(EntityTagsRepository repository, QuestionRepository questionRepository, QuestionPaperRepository questionPaperRepository) {
        this.repository = repository;
        this.questionRepository = questionRepository;
        this.questionPaperRepository = questionPaperRepository;
    }

    /**
     * Get paginated filtered entity response.
     */
    public FilteredEntityResponseDto getFilteredEntityTags(RequestDto filterRequest, int pageNo, int pageSize) {
        String entityName = filterRequest.getType();
        String search = filterRequest.getName();
        Pageable pageable = PageRequest.of(pageNo, pageSize);

        Set<String> tagIds = Optional.ofNullable(filterRequest.getTags())
                .orElse(Collections.emptyList())
                .stream()
                .map(TagFilterRequestDto::getTagId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Page<Object[]> entityResults;
        if(StringUtils.hasText(search)){
            entityResults = repository.findDistinctEntitiesbysearch(entityName, List.copyOf(tagIds), search ,  pageable);
        }
        else {
            entityResults = repository.findDistinctEntities(entityName, List.copyOf(tagIds) ,  pageable);
        }
        return createFilteredEntityResponse(entityResults);
    }

    /**
     * Convert database results to FilteredEntityResponseDto.
     */
    private FilteredEntityResponseDto createFilteredEntityResponse(Page<Object[]> entityResults) {
        List<Map<String, Object>> content = new ArrayList<>();

        if (entityResults.hasContent()) {
            content = entityResults.getContent().stream().map(result -> {
                Map<String, Object> entityMap = new HashMap<>();
                String entityId = (String) result[0];
                String entityType = (String) result[1];

                entityMap.put("entityId", entityId);
                entityMap.put("entityType", entityType);
                entityMap.put("entityData", fetchEntityById(entityId, entityType));

                return entityMap;
            }).collect(Collectors.toList());
        }

        return FilteredEntityResponseDto.builder()
                .content(content)
                .pageNo(entityResults.getNumber())
                .pageSize(entityResults.getSize())
                .totalPages(entityResults.getTotalPages())
                .totalElements(entityResults.getTotalElements())
                .last(entityResults.isLast())
                .build();
    }

    /**
     * Fetch entity details from respective repositories.
     */
    private Object fetchEntityById(String entityId, String entityType) {
        if (entityType == null) return null;

        switch (entityType) {
            case "QUESTION":
                return questionRepository.findById(entityId).orElse(null);
            case "QUESTION_PAPER":
                return questionPaperRepository.findById(entityId).orElse(null);
            default:
                return null;
        }
    }
}
