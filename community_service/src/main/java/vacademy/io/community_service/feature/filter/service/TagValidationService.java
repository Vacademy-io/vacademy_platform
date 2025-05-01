package vacademy.io.community_service.feature.filter.service;

import org.springframework.stereotype.Service;
import vacademy.io.community_service.feature.filter.utils.EnumUtils;
import vacademy.io.community_service.feature.content_structure.enums.Difficulty;
import vacademy.io.community_service.feature.content_structure.enums.DropdownType;
import vacademy.io.community_service.feature.content_structure.enums.Topic;
import vacademy.io.community_service.feature.content_structure.enums.Type;
import vacademy.io.community_service.feature.content_structure.repository.LevelsRepository;
import vacademy.io.community_service.feature.content_structure.repository.StreamsRepository;
import vacademy.io.community_service.feature.content_structure.repository.SubjectsRepository;

@Service
public class TagValidationService {
    private final LevelsRepository levelsRepository;
    private final StreamsRepository streamsRepository;
    private final SubjectsRepository subjectsRepository;

    public TagValidationService(LevelsRepository levelsRepository, StreamsRepository streamsRepository, SubjectsRepository subjectsRepository) {
        this.levelsRepository = levelsRepository;
        this.streamsRepository = streamsRepository;
        this.subjectsRepository = subjectsRepository;
    }

    public boolean isValidTag(String tagSource, String tagId) {
        return switch (DropdownType.valueOf(tagSource.toUpperCase())) {
            case LEVEL -> levelsRepository.existsById(tagId);
            case SUBJECT -> subjectsRepository.existsById(tagId);
            case STREAM -> streamsRepository.existsById(tagId);
            case TOPIC -> EnumUtils.isValidEnum(Topic.class, tagId);
            case DIFFICULTY -> EnumUtils.isValidEnum(Difficulty.class, tagId);
            case TYPE -> EnumUtils.isValidEnum(Type.class, tagId);
        };
    }
}

