package vacademy.io.admin_core_service.features.slide.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.service.HtmlVideoSlideService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/slide/html-video-slide")
public class HtmlVideoSlideController {

    @Autowired
    private HtmlVideoSlideService htmlVideoSlideService;

    @PostMapping("/add-or-update")
    public String addOrUpdateHtmlVideoSlide(@RequestBody SlideDTO slideDTO,
            @RequestParam String chapterId,
            @RequestParam String instituteId,
            @RequestParam String packageSessionId,
            @RequestParam String moduleId,
            @RequestParam String subjectId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return htmlVideoSlideService.addOrUpdateHtmlVideoSlide(slideDTO, chapterId, packageSessionId, moduleId,
                subjectId, userDetails);
    }
}
