package vacademy.io.community_service.feature.content_structure.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.content_structure.dto.*;
import vacademy.io.community_service.feature.content_structure.entity.*;
import vacademy.io.community_service.feature.content_structure.enums.Difficulty;
import vacademy.io.community_service.feature.content_structure.enums.Type;
import vacademy.io.community_service.feature.content_structure.repository.*;
import vacademy.io.community_service.feature.filter.repository.EntityTagsRepository;
import vacademy.io.community_service.feature.question_bank.dto.TagsByIdResponseDto;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Service
public class ContentService {

    @Autowired
    private LevelsRepository levelRepository;

    @Autowired
    private StreamsRepository streamRepository;

    @Autowired
    private ChapterRepository chapterRepository;

    @Autowired
    private SubjectsRepository subjectRepository;


    @Autowired
    private TopicRepository topicRepository;

    @Autowired
    private EntityTagsRepository entityTagsRepository;

    @Transactional
    public ResponseEntity<List<Topic>> getAllTopicsOfChapter(String chapterIds) {
        List<String> chapterList = Stream.of(chapterIds.split(",")).toList();
        return ResponseEntity.ok(topicRepository.findTopicsByChapterId(chapterList));
    }

    public ResponseEntity<List<Chapter>> getAllChaptersOfSubject(String subjectId) {

        return ResponseEntity.ok(chapterRepository.findChaptersOdSubject(subjectId));
    }

    public ResponseEntity<Map<String, String>> addChaptersToSubject(ChapterInsertDto chapterInsertDto) {
        Map<String, String> resultMap = new HashMap<>();
        Optional<Subjects> subject = subjectRepository.findById(chapterInsertDto.getSubjectId());

        if (subject.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        for (ChapterInsertDto.ChapterDto chapterDto : chapterInsertDto.getChapters()) {
            try {
                Chapter chapter = addChapterToSubject(chapterDto);
                chapter = chapterRepository.save(chapter);
                resultMap.put(chapterDto.getChapterName(), chapter.getChapterId());
                subject.get().getChapters().add(chapter);
            }
            catch (Exception e) {
                resultMap.put(chapterDto.getChapterName(), e.getMessage());
            }
        }

        subjectRepository.save(subject.get());
        return ResponseEntity.ok(resultMap);
    }

    public ResponseEntity<Map<String, String>> addTopicsToChapter(TopicInsertDto topicInsertDto) {
        Map<String, String> resultMap = new HashMap<>();
        Optional<Chapter> chapter = chapterRepository.findById(topicInsertDto.getChapterId());

        if (chapter.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        for (TopicInsertDto.TopicDto topicDto : topicInsertDto.getTopics()) {
            try {
                Topic topic = addTopicToChapter(topicDto);
                topic = topicRepository.save(topic);
                chapter.get().getTopics().add(topic);
                resultMap.put(topicDto.getTopicName(), topic.getTopicId());
            }
            catch (Exception e) {
                resultMap.put(topicDto.getTopicName(), e.getMessage());
            }
        }

        chapterRepository.save(chapter.get());
        return ResponseEntity.ok(resultMap);
    }

    Chapter addChapterToSubject(ChapterInsertDto.ChapterDto chapterDto) {
        Chapter chapter = new Chapter();
        chapter.setChapterName(chapterDto.getChapterName().toLowerCase());
        chapter.setChapterOrder(chapterDto.getChapterOrder());
        return chapter;
    }

    Topic addTopicToChapter(TopicInsertDto.TopicDto topicDto) {
        Topic topic = new Topic();
        topic.setTopicName(topicDto.getTopicName().toLowerCase());
        topic.setTopicOrder(topicDto.getTopicOrder());
        return topic;
    }

    public ResponseEntity<Map<String, String>> addChaptersTopicToSubject(ChapterInsertDto chapterInsertDto) {
        Map<String, String> resultMap = new HashMap<>();
        Optional<Subjects> subject = subjectRepository.findById(chapterInsertDto.getSubjectId());

        if (subject.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        for (ChapterInsertDto.ChapterDto chapterDto : chapterInsertDto.getChapters()) {
            try {
                Chapter chapter = addChapterToSubject(chapterDto);
                chapter = chapterRepository.save(chapter);
                resultMap.put(chapterDto.getChapterName(), chapter.getChapterId());
                subject.get().getChapters().add(chapter);
                for (TopicInsertDto.TopicDto topicDto : chapterDto.getTopics()) {
                    Topic topic = addTopicToChapter(topicDto);
                    topic = topicRepository.save(topic);
                    chapter.getTopics().add(topic);
                }
                chapterRepository.save(chapter);
            }
            catch (Exception e) {
                resultMap.put(chapterDto.getChapterName(), e.getMessage());
            }
        }

        subjectRepository.save(subject.get());
        return ResponseEntity.ok(resultMap);
    }

}
