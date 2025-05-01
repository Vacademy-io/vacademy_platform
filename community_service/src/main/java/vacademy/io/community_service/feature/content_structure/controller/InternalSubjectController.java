package vacademy.io.community_service.feature.content_structure.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.content_structure.dto.ChapterInsertDto;
import vacademy.io.community_service.feature.content_structure.entity.Chapter;
import vacademy.io.community_service.feature.content_structure.service.ContentService;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/community-service/subject")
public class InternalSubjectController {

    @Autowired
    private ContentService contentService;

    @GetMapping("/all-chapters")
    public ResponseEntity<List<Chapter>> getAllChaptersOfSubject(@RequestParam String subjectId) {
        return contentService.getAllChaptersOfSubject(subjectId);
    }

    @PostMapping("/add-chapters")
    public ResponseEntity<Map<String, String>> addChaptersToSubject(@RequestBody ChapterInsertDto chapterInsertDto) {
        return contentService.addChaptersToSubject(chapterInsertDto);
    }

    @PostMapping("/add-chapters-with-topics")
    public ResponseEntity<Map<String, String>> addChaptersTopicsToSubject(CustomUserDetails user, @RequestBody ChapterInsertDto chapterInsertDto) {
        return contentService.addChaptersTopicToSubject(chapterInsertDto);
    }
}
