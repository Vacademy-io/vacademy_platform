package vacademy.io.admin_core_service.features.slide.controller;

import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.slide.dto.*;
import vacademy.io.admin_core_service.features.slide.service.SlideMetaDataService;
import vacademy.io.admin_core_service.features.slide.service.SlideService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/admin-core-service/slide/v1")
@AllArgsConstructor
public class SlideController {
    private final SlideService slideService;

    @PostMapping("/add-update-document-slide")
    public ResponseEntity<String> addDocumentSlide(@RequestBody AddDocumentSlideDTO addDocumentSlideDTO, @RequestParam("chapterId") String chapterId, @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(slideService.addOrUpdateDocumentSlide(addDocumentSlideDTO, chapterId, instituteId));
    }

    @PostMapping("/add-update-video-slide")
    public ResponseEntity<String> addVideoSlide(@RequestBody AddVideoSlideDTO addVideoSlideDTO, @RequestParam String chapterId, @RequestParam String instituteId) {
        return ResponseEntity.ok(slideService.addOrUpdateVideoSlide(addVideoSlideDTO, chapterId, instituteId));
    }

    @GetMapping("/get-slides/{chapterId}")
    public ResponseEntity<List<SlideDetailProjection>> getSlidesByChapterId(@PathVariable String chapterId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(slideService.getSlidesByChapterId(chapterId, user));
    }

    @PutMapping("/update-status")
    public ResponseEntity<String> updateSlideStatus(
            @RequestParam String chapterId,
            @RequestParam String slideId,
            @RequestParam String instituteId,
            @RequestParam String status) {
        return ResponseEntity.ok(slideService.updateSlideStatus(instituteId, chapterId, slideId, status));
    }

    @PutMapping("/update-slide-order")
    public ResponseEntity<String> updateSlideOrder(@RequestBody List<UpdateSlideOrderDTO> updateSlideOrderDTOs, @RequestParam String chapterId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(slideService.updateSlideOrder(updateSlideOrderDTOs, chapterId, user));
    }

    @PostMapping("/copy")
    public ResponseEntity<String> copySlide(
            @RequestParam String slideId,
            @RequestParam String newChapterId,
            @RequestAttribute("user") CustomUserDetails user) {
        String message = slideService.copySlide(slideId, newChapterId, user);
        return ResponseEntity.ok(message);
    }

    @PostMapping("/move")
    public ResponseEntity<String> moveSlide(
            @RequestParam String slideId,
            @RequestParam String oldChapterId,
            @RequestParam String newChapterId,
            @RequestAttribute("user") CustomUserDetails user) {
        String message = slideService.moveSlide(slideId, oldChapterId, newChapterId, user);
        return ResponseEntity.ok(message);
    }

    @GetMapping("/slides")
    public ResponseEntity<List<SlideDTO>> getSlides(String chapterId) {
        return ResponseEntity.ok(slideService.getSlides(chapterId));
    }

    @GetMapping("/slide-counts-by-source-type")
    public ResponseEntity<List<SlideTypeCountProjection>> getSlideCountsBySourceType(
            @RequestParam String packageSessionId
    ) {
        List<SlideTypeCountProjection> result = slideService.getSlideCountsBySourceType(packageSessionId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/learner-slide-counts-by-source-type")
    public ResponseEntity<List<SlideTypeCountProjection>> getLearnerSlideCountsBySourceType(
            @RequestParam String packageSessionId
    ) {
        List<SlideTypeCountProjection> result = slideService.getSlideCountsBySourceTypeForLearner(packageSessionId);
        return ResponseEntity.ok(result);
    }

}
