package vacademy.io.admin_core_service.features.slide.controller;

import lombok.AllArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.slide.dto.SlideDetailWithOperationProjection;
import vacademy.io.admin_core_service.features.slide.service.LearnerSlideService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/slide/institute-learner/v1")
@AllArgsConstructor
public class LearnerSlideController {
    @Autowired
    private final LearnerSlideService learnerSlideService;

    @GetMapping("/get-slides-with-status")
    public ResponseEntity<List<SlideDetailWithOperationProjection>> getLearnerSlides(@RequestParam("userId") String userId, @RequestParam("chapterId") String chapterId, @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(learnerSlideService.getLearnerSlides(userId, chapterId, userDetails));
    }
}
