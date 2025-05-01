package vacademy.io.community_service.feature.filter.service;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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


    public ResponseEntity<Map<String, Map<String, List<Object>>>> getTags(CustomUserDetails user, String entityName, List<String> entityIds) {
        List<EntityTags> entityTags = entityTagsRepository.findAllByEntityNameAndEntityIds(entityName, entityIds);

        Map<String, Map<String, List<Object>>> response = new HashMap<>();

        for (String entityId : entityIds) {
            Map<String, List<Object>> entityMap = new HashMap<>();
            List<EntityTags> filteredTags = entityTags.stream().filter(entityTag -> entityTag.getEntityId().equals(entityId)).toList();

            if (!filteredTags.isEmpty()) {
                // Finding all DIFFICULTY
                List<EntityTags> difficultyTags = filteredTags.stream().filter(entityTag -> entityTag.getTagSource().equals("DIFFICULTY")).toList();
                List<Object> difficultyList = new ArrayList<>();
                for (EntityTags difficultyTag : difficultyTags) {
                    difficultyList.add(difficultyTag.getTagId());
                }
                entityMap.put("DIFFICULTY", difficultyList);

                // Finding all TAGS
                List<EntityTags> tagTags = filteredTags.stream().filter(entityTag -> entityTag.getTagSource().equals("TAGS")).toList();
                List<Object> tagList = new ArrayList<>();
                for (EntityTags tagTag : tagTags) {
                    tagList.add(tagTag.getTag());
                }
                entityMap.put("TAGS", tagList);

                // Finding all Chapters
                List<EntityTags> chapterTags = filteredTags.stream().filter(entityTag -> entityTag.getTagSource().equals("CHAPTER")).toList();
                List<Object> chapterList = new ArrayList<>();
                for (EntityTags chapterTag : chapterTags) {
                    chapterList.add(chapterTag.getChapter());
                }
                entityMap.put("CHAPTER", chapterList);

                // Finding all TOPICS
                List<EntityTags> topicTags = filteredTags.stream().filter(entityTag -> entityTag.getTagSource().equals("TOPIC")).toList();
                List<Object> topicList = new ArrayList<>();
                for (EntityTags topicTag : topicTags) {
                    topicList.add(topicTag.getTopic());
                }
                entityMap.put("TOPIC", topicList);

            }

            response.put(entityId, entityMap);
        }

        return new ResponseEntity<>(response, HttpStatus.OK);
    }
}
