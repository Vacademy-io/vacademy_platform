package vacademy.io.admin_core_service.features.slide.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.service.VideoSlideService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/slide/video-slide")
public class VideoSlideController {

    @Autowired
    private VideoSlideService videoSlideService;

    @PostMapping("/add-or-update")
    public String addOrUpdateVideoSlide(@RequestBody SlideDTO slideDTO,
                                        @RequestParam String chapterId,
                                        @RequestAttribute("user") CustomUserDetails userDetails) {
        return videoSlideService.addOrUpdateVideoSlide(slideDTO, chapterId, userDetails);
    }
}
