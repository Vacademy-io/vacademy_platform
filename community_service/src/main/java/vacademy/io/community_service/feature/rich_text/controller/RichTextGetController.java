package vacademy.io.community_service.feature.rich_text.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.rich_text.dto.AssessmentRichTextDataDTO;
import vacademy.io.community_service.feature.rich_text.manager.RichTextManager;

import java.util.List;

@RestController
@RequestMapping("/assessment-service/assessment/rich-text")
public class RichTextGetController {

    @Autowired
    RichTextManager richTextManager;

    @GetMapping("/by-ids")
    public ResponseEntity<List<AssessmentRichTextDataDTO>> getRichTextData(@RequestAttribute("user") CustomUserDetails user, @RequestParam("richTextIds") String richTextIds) {
        return ResponseEntity.ok(richTextManager.getRichTextData(user, richTextIds));
    }

}
