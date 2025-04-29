package vacademy.io.community_service.feature.question_bank.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.question_bank.dto.TagsWithQuestionPaperResponseDto;
import vacademy.io.community_service.feature.question_bank.services.TagsService;

@RestController
@RequestMapping("/community-service")
public class GetTagsByQuestionId {
    @Autowired
    private TagsService tagsService;

    @GetMapping("/get-tags")
    public ResponseEntity<TagsWithQuestionPaperResponseDto> getFilteredEntityTags(@RequestAttribute("user") CustomUserDetails user,
                                                                                  @RequestParam(value = "questionPaperId", required = true) String questionPaperId) {
        TagsWithQuestionPaperResponseDto tagsWithQuestionPaper = tagsService.getQuestionPaperTags(questionPaperId);
        return ResponseEntity.ok(tagsWithQuestionPaper);
    }
}



