package vacademy.io.community_service.feature.init.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.init.dto.*;
import vacademy.io.community_service.feature.init.entity.*;
import vacademy.io.community_service.feature.init.enums.Difficulty;
import vacademy.io.community_service.feature.init.enums.Topic;
import vacademy.io.community_service.feature.init.enums.Type;
import vacademy.io.community_service.feature.init.repository.*;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Service
public class InitService {

    @Autowired
    private LevelsRepository levelRepository;

    @Autowired
    private StreamsRepository streamRepository;

    @Autowired
    private SubjectsRepository subjectRepository;

    public ResponseEntity<InitResponseDto> getDropdownOptions(CustomUserDetails user) {
        List<Levels> levelEntities = levelRepository.findAll();
        List<LevelDto> levels = levelEntities.stream()
                .map(level -> new LevelDto(level.getLevelId(), level.getLevelName()))
                .collect(Collectors.toList());

        // Fetch streams mapped to levels
        Map<String, List<StreamDto>> streams = levelEntities.stream()
                .collect(Collectors.toMap(
                        Levels::getLevelId,
                        level -> level.getStreams().stream()
                                .map(stream -> new StreamDto(stream.getStreamId(), stream.getStreamName()))
                                .collect(Collectors.toList()),
                        (existing, replacement) -> existing
                ));

        // Fetch all streams
        List<Streams> streamEntities = streamRepository.findAll();
        Map<String, List<SubjectDto>> subjects = streamEntities.stream()
                .collect(Collectors.toMap(
                        Streams::getStreamId,
                        stream -> stream.getSubjects().stream()
                                .map(subject -> new SubjectDto(subject.getSubjectId(), subject.getSubjectName()))
                                .collect(Collectors.toList()),
                        (existing, replacement) -> existing
                ));



        List<String> difficulties = Stream.of(Difficulty.values()).map(Enum::name).collect(Collectors.toList());
        List<String> topics = Stream.of(Topic.values()).map(Enum::name).collect(Collectors.toList());
        List<String> types = Stream.of(Type.values()).map(Enum::name).collect(Collectors.toList());

        return ResponseEntity.ok(new InitResponseDto(levels, streams, subjects, difficulties, topics, types));

    }
}
