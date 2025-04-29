package vacademy.io.assessment_service.features.rich_text.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;
import vacademy.io.assessment_service.features.rich_text.manager.RichTextManager;
import vacademy.io.common.auth.model.CustomUserDetails;

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
