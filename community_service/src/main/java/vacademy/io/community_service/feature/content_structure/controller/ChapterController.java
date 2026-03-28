package vacademy.io.community_service.feature.content_structure.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Chapter", description = "APIs for managing chapters and topics within the content structure")
public class ChapterController {

    @Autowired
    private ContentService contentService;

    @Operation(summary = "Get all topics of a chapter",
            description = "Returns all topics belonging to the specified chapter IDs")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Topics retrieved successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid chapter IDs provided"),
            @ApiResponse(responseCode = "404", description = "Chapter not found")
    })
    @GetMapping("/all-topics")
    public ResponseEntity<List<Topic>> getAllTopicsOfChapter(
            @Parameter(description = "Comma-separated chapter IDs", required = true, example = "uuid1,uuid2")
            @RequestParam String chapterIds) {
        return contentService.getAllTopicsOfChapter(chapterIds);
    }

    @Operation(summary = "Add topics to a chapter",
            description = "Creates new topics and associates them with the specified chapter")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Topics added successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid request body")
    })
    @PostMapping("/add-topics")
    public ResponseEntity<Map<String, String>> addTopicsToChapter(@RequestBody TopicInsertDto topicInsertDto) {
        return contentService.addTopicsToChapter(topicInsertDto);
    }
}
