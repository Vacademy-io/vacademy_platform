package vacademy.io.community_service.feature.filter.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.filter.dto.AddTagsRequestDto;
import vacademy.io.community_service.feature.filter.entity.EntityTags;
import vacademy.io.community_service.feature.filter.enums.EntityName;
import vacademy.io.community_service.feature.filter.repository.EntityTagsRepository;
import vacademy.io.community_service.feature.init.enums.DropdownType;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class EntityTagsService {

    private final EntityTagsRepository entityTagsRepository;
    private final EntityValidationService entityValidationService;
    private final TagValidationService tagValidationService;

    public EntityTagsService(TagValidationService tagValidationService , EntityValidationService entityValidationService , EntityTagsRepository entityTagsRepository) {
        this.entityTagsRepository = entityTagsRepository;
        this.entityValidationService = entityValidationService;
        this.tagValidationService = tagValidationService;
    }

    @Transactional
    public void addTagsToEntity(CustomUserDetails user, AddTagsRequestDto requestDto) {
        // Validate Entity Name
        if (!EntityName.isValid(requestDto.getEntityName())) {
            throw new IllegalArgumentException("Invalid entityName. Allowed values: QUESTION, QUESTION_PAPER, PDF, VIDEO, PPT");
        }

        if (!entityValidationService.validateEntity(requestDto.getEntityName(), requestDto.getEntityId())) {
            throw new IllegalArgumentException("Entity ID does not exist.");
        }

        // Convert each tagId to an EntityTags object
        List<EntityTags> validTags = requestDto.getTags().stream()
                .filter(tag -> DropdownType.isValid(tag.getTagSource()) &&
                        tagValidationService.isValidTag(tag.getTagSource(), tag.getTagId()))
                .map(tag -> new EntityTags(requestDto.getEntityId(), requestDto.getEntityName(), tag.getTagId(), tag.getTagSource()))
                .collect(Collectors.toList());

        if (validTags.isEmpty()) {
            throw new IllegalArgumentException("No valid tags provided.");
        }

        validTags.forEach(tag -> {
            entityTagsRepository.insertIgnoreConflict(
                    tag.getEntityId(),
                    tag.getEntityName(),
                    tag.getTagId(),
                    tag.getTagSource()
            );
        });
    }
}
