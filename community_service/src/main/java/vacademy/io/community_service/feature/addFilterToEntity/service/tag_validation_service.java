package vacademy.io.community_service.feature.addFilterToEntity.service;

import vacademy.io.community_service.feature.addFilterToEntity.utils.enum_utils;
import vacademy.io.community_service.feature.init.enums.Topic;
import vacademy.io.community_service.feature.init.enums.Type;
import vacademy.io.community_service.feature.init.repository.LevelsRepository;
import vacademy.io.community_service.feature.init.repository.StreamsRepository;
import vacademy.io.community_service.feature.init.repository.SubjectsRepository;
import org.springframework.stereotype.Service;
import vacademy.io.community_service.feature.init.enums.Difficulty;
import vacademy.io.community_service.feature.init.enums.DropdownType;

@Service
public class tag_validation_service {
    private final LevelsRepository levelsRepository;
    private final StreamsRepository streamsRepository;
    private final SubjectsRepository subjectsRepository;

    public tag_validation_service(LevelsRepository levelsRepository, StreamsRepository streamsRepository, SubjectsRepository subjectsRepository) {
        this.levelsRepository = levelsRepository;
        this.streamsRepository = streamsRepository;
        this.subjectsRepository = subjectsRepository;
    }

    public boolean isValidTag(String tagSource, String tagId) {
        return switch (DropdownType.valueOf(tagSource.toUpperCase())) {
            case LEVEL -> levelsRepository.existsById(tagId);
            case SUBJECT -> subjectsRepository.existsById(tagId);
            case STREAM -> streamsRepository.existsById(tagId);
            case TOPIC -> enum_utils.isValidEnum(Topic.class, tagId);
            case DIFFICULTY -> enum_utils.isValidEnum(Difficulty.class, tagId);
            case TYPE -> enum_utils.isValidEnum(Type.class, tagId);
        };
    }
}

