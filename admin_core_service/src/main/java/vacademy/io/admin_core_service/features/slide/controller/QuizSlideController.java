package vacademy.io.admin_core_service.features.slide.controller;

import lombok.AllArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.service.AssignmentSlideService;
import vacademy.io.admin_core_service.features.slide.service.QuestionSlideService;
import vacademy.io.admin_core_service.features.slide.service.QuizSlideService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/slide/quiz-slide")
public class QuizSlideController {

    @Autowired
    private QuizSlideService questionSlideService;

    @PostMapping("/add-or-update")
    public String addOrUpdateQuizSlide(@RequestBody SlideDTO slideDTO,
                                     @RequestParam String chapterId,
                                     @RequestParam String instituteId,
                                     @RequestParam String packageSessionId,
                                     @RequestParam String subjectId,
                                     @RequestParam String moduleId,
                                     @RequestAttribute("user") CustomUserDetails userDetails) {

        return questionSlideService.addOrUpdateQuizSlide(slideDTO, chapterId,packageSessionId,moduleId,subjectId, userDetails);
    }
}
