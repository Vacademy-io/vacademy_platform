package vacademy.io.admin_core_service.features.slide.controller;

import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.slide.dto.AddDocumentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.AddVideoSlideDTO;
import vacademy.io.admin_core_service.features.slide.service.SlideService;

@RestController
@RequestMapping("/admin-core-service/slide/v1")
@AllArgsConstructor
public class SlideController {
    private final SlideService slideService;

    @PostMapping("/add-document-slide/{chapterId}")
    public ResponseEntity<String> addDocumentSlide(@RequestBody AddDocumentSlideDTO addDocumentSlideDTO, @PathVariable String chapterId) {
        return ResponseEntity.ok(slideService.addDocumentSlide(addDocumentSlideDTO, chapterId));
    }

    @PostMapping("/add-video-slide/{chapterId}")
    public ResponseEntity<String> addVideoSlide(@RequestBody AddVideoSlideDTO addVideoSlideDTO, @PathVariable String chapterId) {
        return ResponseEntity.ok(slideService.addVideoSlide(addVideoSlideDTO, chapterId));
    }
}
