package vacademy.io.community_service.feature.addFilterToEntity.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.addFilterToEntity.dto.add_tags_request_dto;
import vacademy.io.community_service.feature.addFilterToEntity.entity.entity_tags;
import vacademy.io.community_service.feature.addFilterToEntity.enums.entity_name;
import vacademy.io.community_service.feature.addFilterToEntity.repository.entity_tags_repository;
import vacademy.io.community_service.feature.init.enums.DropdownType;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class entity_tags_service {

    private final entity_tags_repository entityTagsRepository;
    private final entity_validation_service entityValidationService;
    private final tag_validation_service tagValidationService;

    public entity_tags_service(tag_validation_service tagValidationService , entity_validation_service entityValidationService , entity_tags_repository entityTagsRepository) {
        this.entityTagsRepository = entityTagsRepository;
        this.entityValidationService = entityValidationService;
        this.tagValidationService = tagValidationService;
    }

    @Transactional
    public void addTagsToEntity(CustomUserDetails user, add_tags_request_dto requestDto) {
        // Validate Entity Name
        if (!entity_name.isValid(requestDto.getEntityName())) {
            throw new IllegalArgumentException("Invalid entityName. Allowed values: QUESTION, QUESTION_PAPER, PDF, VIDEO, PPT");
        }

        if (!entityValidationService.validateEntity(requestDto.getEntityName(), requestDto.getEntityId())) {
            throw new IllegalArgumentException("Entity ID does not exist.");
        }

        // Convert each tagId to an EntityTags object
        List<entity_tags> validTags = requestDto.getTags().stream()
                .filter(tag -> DropdownType.isValid(tag.getTagSource()) &&
                        tagValidationService.isValidTag(tag.getTagSource(), tag.getTagId()))
                .map(tag -> new entity_tags(requestDto.getEntityId(), requestDto.getEntityName(), tag.getTagId(), tag.getTagSource()))
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
