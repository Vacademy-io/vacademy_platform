package vacademy.io.community_service.feature.question_bank.services;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import vacademy.io.community_service.feature.filter.entity.EntityTags;
import vacademy.io.community_service.feature.filter.repository.EntityTagsRepository;
import vacademy.io.community_service.feature.filter.repository.QuestionPaperRepository;
import vacademy.io.community_service.feature.filter.repository.QuestionRepository;
import vacademy.io.community_service.feature.question_bank.dto.FilteredEntityResponseDto;
import vacademy.io.community_service.feature.question_bank.dto.RequestDto;
import vacademy.io.community_service.feature.question_bank.dto.TagFilterRequestDto;
import vacademy.io.community_service.feature.question_bank.dto.TagResponseDto;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class FilterEntityService {

    private final EntityTagsRepository repository;
    private final QuestionRepository questionRepository;
    private final QuestionPaperRepository questionPaperRepository;

    public FilterEntityService(EntityTagsRepository repository , QuestionRepository questionRepository , QuestionPaperRepository questionPaperRepository) {
        this.repository = repository;
        this.questionRepository = questionRepository;
        this.questionPaperRepository = questionPaperRepository;
    }

    /**
     * Get filtered EntityTags based on user-provided filters.
     * If no filters are provided, return all entities.
     */
    public List<FilteredEntityResponseDto> getFilteredEntityTags(RequestDto filterRequest) {
        List<EntityTags> entityTagsList;

        // Return all entities if no filters are provided
        if ((Objects.isNull(filterRequest.getType())  || filterRequest.getType().isEmpty()) &&
                (filterRequest.getTags() == null || filterRequest.getTags().isEmpty())) {
            entityTagsList = repository.findAll();
        } else {
            Specification<EntityTags> spec = Specification.where(null);

            // Filter by Type
            if ( !(Objects.isNull(filterRequest.getType()) && !filterRequest.getType().isEmpty())) {
                spec = spec.and((root, query, criteriaBuilder) ->
                        criteriaBuilder.equal(root.get("id").get("entityName"), filterRequest.getType()));
            }

            // Filter by Tags
            // using or operator to make the specs
            if ( !Objects.isNull(filterRequest.getTags()) && !filterRequest.getTags().isEmpty()) {
                List<String> tagIds = filterRequest.getTags().stream()
                        .map(TagFilterRequestDto::getTagId)
                        .filter(tagId -> tagId != null && !tagId.isEmpty())
                        .collect(Collectors.toList());

                List<String> tagSources = filterRequest.getTags().stream()
                        .map(TagFilterRequestDto::getTagSource)
                        .filter(tagSource -> tagSource != null && !tagSource.isEmpty())
                        .collect(Collectors.toList());

                if (!tagIds.isEmpty()) {
                    spec = spec.and((root, query, criteriaBuilder) ->
                            root.get("id").get("tagId").in(tagIds));
                }

                if (!tagSources.isEmpty()) {
                    spec = spec.and((root, query, criteriaBuilder) ->
                            root.get("tagSource").in(tagSources));
                }
            }



            entityTagsList = repository.findAll(spec);
        }

        // Grouping tags by entityId
        Map<String, FilteredEntityResponseDto> entityMap = new LinkedHashMap<>();

        for (EntityTags entityTag : entityTagsList) {
            String entityId = entityTag.getId().getEntityId();
            String entityName = entityTag.getId().getEntityName();
            String tagId = entityTag.getId().getTagId();
            String tagSource = entityTag.getTagSource();

            entityMap.computeIfAbsent(entityId, id -> {
                Object entityData = fetchEntityById(entityId, entityName); // Fetch entity from DB
                return new FilteredEntityResponseDto(entityId, entityName, new ArrayList<>(), entityData);
            }).getTags().add(new TagResponseDto(tagId, tagSource));
        }

        return new ArrayList<>(entityMap.values());
    }
    private Object fetchEntityById(String entityId, String entityName) {
        switch (entityName) {
            case "QUESTION":
                return questionRepository.findById(entityId).orElse(null);
            case "QUESTION_PAPER":
                return questionPaperRepository.findById(entityId).orElse(null);
            default:
                return null;
        }
    }
}
