package vacademy.io.admin_core_service.features.slide.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.service.QuestionSlideService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/slide/question-slide")
public class QuestionSlideController {

    @Autowired
    private QuestionSlideService questionSlideService;

    @PostMapping("/add-or-update")
    public String addQuestionSlide(@RequestBody SlideDTO slideDTO,
                                   @RequestParam String chapterId,
                                   @RequestAttribute("user") CustomUserDetails userDetails) {

        return questionSlideService.addOrUpdateQuestionSlide(slideDTO, chapterId, userDetails);
    }

}
