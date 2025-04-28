package vacademy.io.admin_core_service.features.slide.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.service.AssignmentSlideService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/slide/assignment-slide")
public class AssignmentSlideController {

    @Autowired
    private AssignmentSlideService assignmentSlideService;

    @PostMapping("/add-or-update")
    public String addAssignmentSlide(@RequestBody SlideDTO slideDTO,
                                     @RequestParam String chapterId,
                                     @RequestAttribute("user") CustomUserDetails userDetails) {

        return assignmentSlideService.addOrUpdateAssignmentSlide(slideDTO, chapterId, userDetails);
    }
}
