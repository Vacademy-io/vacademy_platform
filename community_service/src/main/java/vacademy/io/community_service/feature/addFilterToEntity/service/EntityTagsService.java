package vacademy.io.community_service.feature.addFilterToEntity.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.addFilterToEntity.dto.AddTagsRequestDto;
import vacademy.io.community_service.feature.addFilterToEntity.entity.EntityTags;
import vacademy.io.community_service.feature.addFilterToEntity.enums.EntityName;
import vacademy.io.community_service.feature.addFilterToEntity.repository.EntityTagsRepository;
import vacademy.io.community_service.feature.addFilterToEntity.repository.QuestionPaperRepository;
import vacademy.io.community_service.feature.addFilterToEntity.repository.QuestionRepository;
import vacademy.io.community_service.feature.init.enums.Difficulty;
import vacademy.io.community_service.feature.init.enums.DropdownType;
import vacademy.io.community_service.feature.init.enums.Topic;
import vacademy.io.community_service.feature.init.enums.Type;
import vacademy.io.community_service.feature.init.repository.LevelsRepository;
import vacademy.io.community_service.feature.init.repository.StreamsRepository;
import vacademy.io.community_service.feature.init.repository.SubjectsRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class EntityTagsService {

    private final EntityTagsRepository entityTagsRepository;
    private final QuestionRepository questionRepository;
    private final QuestionPaperRepository questionPaperRepository;
    private final LevelsRepository levelsRepository;
    private final StreamsRepository  streamsRepository;
    private final SubjectsRepository subjectsRepository;

    private <E extends Enum<E>> boolean isValidEnum(Class<E> enumClass, String value) {
        for (E e : enumClass.getEnumConstants()) {
            if (e.name().equals(value)) {
                return true;
            }
        }
        return false;
    }

    public EntityTagsService(EntityTagsRepository entityTagsRepository, QuestionRepository questionRepository, QuestionPaperRepository questionPaperRepository , LevelsRepository levelsRepository , StreamsRepository  streamsRepository , SubjectsRepository subjectsRepository) {
        this.entityTagsRepository = entityTagsRepository;
        this.questionRepository = questionRepository;
        this.questionPaperRepository = questionPaperRepository;
        this.levelsRepository = levelsRepository;
        this.streamsRepository = streamsRepository;
        this.subjectsRepository = subjectsRepository;
    }

    @Transactional
    public void addTagsToEntity(CustomUserDetails user, AddTagsRequestDto requestDto) {
        // Validate Entity Name
        if (!EntityName.isValid(requestDto.getEntityName())) {
            throw new IllegalArgumentException("Invalid entityName. Allowed values: QUESTION, QUESTION_PAPER, PDF, VIDEO, PPT");
        }

        // Check if entityId exists in the corresponding table
        boolean entityExists = switch (EntityName.valueOf(requestDto.getEntityName().toUpperCase())) {
            case QUESTION -> questionRepository.existsById(requestDto.getEntityId());
            case QUESTION_PAPER -> questionPaperRepository.existsById(requestDto.getEntityId());
            default -> true; // For now, assume other types don't need validation
        };

        if (!entityExists) {
            throw new IllegalArgumentException("Entity ID does not exist in the corresponding table: " + requestDto.getEntityName());
        }

        // Convert each tagId to an EntityTags object
        List<EntityTags> validTags = requestDto.getTags().stream()
                .filter(tag -> {
                    if (!DropdownType.isValid(tag.getTagSource())) {
                        return false;
                    }
                    boolean tagExists = switch (DropdownType.valueOf(tag.getTagSource().toUpperCase())) {
                        case LEVEL -> levelsRepository.existsById(tag.getTagId());
                        case SUBJECT -> subjectsRepository.existsById(tag.getTagId());
                        case STREAM -> streamsRepository.existsById(tag.getTagId());
                        case TOPIC -> isValidEnum(Topic.class, tag.getTagId());
                        case DIFFICULTY -> isValidEnum(Difficulty.class, tag.getTagId());
                        case TYPE -> isValidEnum(Type.class, tag.getTagId());
                    };
                    return tagExists;
                })
                .map(tag -> {
                    EntityTags entityTag = new EntityTags();
                    entityTag.setEntityId(requestDto.getEntityId());
                    entityTag.setEntityName(requestDto.getEntityName());
                    entityTag.setTagId(tag.getTagId());
                    entityTag.setTagSource(tag.getTagSource());
                    return entityTag;
                })
                .collect(Collectors.toList());

        if (!validTags.isEmpty()) {
            validTags.forEach(tag -> {
                entityTagsRepository.insertIgnoreConflict(
                        tag.getEntityId(),
                        tag.getEntityName(),
                        tag.getTagId(),
                        tag.getTagSource()
                );
            });

        } else {
            throw new IllegalArgumentException("No valid tags provided.");
        }
    }
}
