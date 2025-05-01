package vacademy.io.community_service.feature.filter.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.filter.dto.AddTagsRequestDto;
import vacademy.io.community_service.feature.filter.entity.EntityTags;
import vacademy.io.community_service.feature.filter.entity.EntityTagsId;
import vacademy.io.community_service.feature.filter.enums.EntityName;
import vacademy.io.community_service.feature.filter.repository.EntityTagsRepository;
import vacademy.io.community_service.feature.content_structure.entity.Tags;
import vacademy.io.community_service.feature.content_structure.enums.DropdownType;
import vacademy.io.community_service.feature.content_structure.repository.TagsRepository;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class EntityTagsService {

    private final EntityTagsRepository entityTagsRepository;
    private final EntityValidationService entityValidationService;
    private final TagValidationService tagValidationService;
    private final TagsRepository tagsRepository;

    public EntityTagsService(TagsRepository tagsRepository, TagValidationService tagValidationService, EntityValidationService entityValidationService, EntityTagsRepository entityTagsRepository) {
        this.entityTagsRepository = entityTagsRepository;
        this.entityValidationService = entityValidationService;
        this.tagValidationService = tagValidationService;
        this.tagsRepository = tagsRepository;
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

        // Process comma-separated tags and save them
        List<Tags> savedTags = processCommaSeparatedTags(requestDto.getCommaSeparatedTags());

        // Convert saved tags to EntityTags format
        List<EntityTags> entityTagsList = savedTags.stream()
                .map(tag -> new EntityTags(
                        new EntityTagsId(requestDto.getEntityId(), requestDto.getEntityName(), tag.getTagId()),
                        "TAGS"
                ))
                .collect(Collectors.toList());

        // Add Tags from `tags` list (if provided separately)
        List<EntityTags> validTags = Optional.ofNullable(requestDto.getTags())
                .orElse(Collections.emptyList()) // Prevent NullPointerException
                .stream()
                .filter(tag -> DropdownType.isValid(tag.getTagSource()) &&
                        tagValidationService.isValidTag(tag.getTagSource(), tag.getTagId()))
                .map(tag -> new EntityTags(
                        new EntityTagsId(requestDto.getEntityId(), requestDto.getEntityName(), tag.getTagId()),
                        tag.getTagSource()
                ))
                .collect(Collectors.toList());

        // Combine both sources
        entityTagsList.addAll(validTags);

        if (entityTagsList.isEmpty()) {
            throw new IllegalArgumentException("No valid tags provided.");
        }

        // Insert into entity_tags table (avoiding conflicts)
        entityTagsList.forEach(tag -> {
            entityTagsRepository.insertIgnoreConflict(
                    tag.getEntityId(),
                    tag.getEntityName(),
                    tag.getTagId(),
                    tag.getTagSource()
            );
        });
    }

    private List<Tags> processCommaSeparatedTags(String commaSeparatedTags) {
        if (commaSeparatedTags == null || commaSeparatedTags.trim().isEmpty()) {
            return List.of();
        }

        // Convert to Set to remove duplicates
        Set<String> tagNames = Arrays.stream(commaSeparatedTags.split(","))
                .map(String::trim)
                .map(String::toLowerCase) // Convert to lowercase
                .filter(tag -> !tag.isEmpty())
                .collect(Collectors.toSet());

        // Fetch existing tags
        List<Tags> existingTags = tagsRepository.findAllByTagNameIn(tagNames);
        Set<String> existingTagNames = existingTags.stream()
                .map(Tags::getTagName)
                .collect(Collectors.toSet());

        // Identify new tags to insert
        List<Tags> newTags = tagNames.stream()
                .filter(tagName -> !existingTagNames.contains(tagName))
                .map(tagName -> {
                    Tags tag = new Tags();
                    tag.setTagId(UUID.randomUUID().toString()); // Generate a unique ID
                    tag.setTagName(tagName);
                    return tag;
                })
                .toList();

        // Save new tags and return all tags
        if (!newTags.isEmpty()) {
            newTags = tagsRepository.saveAll(newTags);
        }

        existingTags.addAll(newTags);
        return existingTags;
    }
}
