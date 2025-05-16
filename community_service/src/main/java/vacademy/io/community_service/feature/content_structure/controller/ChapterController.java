package vacademy.io.community_service.feature.content_structure.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.content_structure.dto.ChapterInsertDto;
import vacademy.io.community_service.feature.content_structure.dto.InitResponseDto;
import vacademy.io.community_service.feature.content_structure.dto.TopicInsertDto;
import vacademy.io.community_service.feature.content_structure.entity.Topic;
import vacademy.io.community_service.feature.content_structure.service.ContentService;
import vacademy.io.community_service.feature.content_structure.service.InitService;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/community-service/chapter")
public class ChapterController {

    @Autowired
    private ContentService contentService;

    @GetMapping("/all-topics")
    public ResponseEntity<List<Topic>> getAllTopicsOfChapter(@RequestParam String chapterIds) {
        return contentService.getAllTopicsOfChapter(chapterIds);
    }

    @PostMapping("/add-topics")
    public ResponseEntity<Map<String, String>> addTopicsToChapter(@RequestBody TopicInsertDto topicInsertDto) {
        return contentService.addTopicsToChapter(topicInsertDto);
    }
}

