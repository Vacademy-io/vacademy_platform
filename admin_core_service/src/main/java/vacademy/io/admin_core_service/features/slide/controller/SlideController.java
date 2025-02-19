package vacademy.io.admin_core_service.features.slide.controller;

import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.slide.dto.AddDocumentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.AddVideoSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDetailProjection;
import vacademy.io.admin_core_service.features.slide.dto.UpdateSlideOrderDTO;
import vacademy.io.admin_core_service.features.slide.service.SlideService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

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

}
