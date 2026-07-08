package vacademy.io.admin_core_service.features.slide.controller;

import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.slide.dto.SlideContentHistoryDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideContentRestoreResponseDTO;
import vacademy.io.admin_core_service.features.slide.service.SlideContentHistoryService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Version history for slide content (document / video / audio), backed by the
 * trigger-written slide_content_history audit table. List shows metadata only;
 * detail returns the snapshot bodies for preview; restore copies a snapshot
 * back into the slide's draft columns.
 */
@RestController
@RequestMapping("/admin-core-service/slide/v1/content-history")
@AllArgsConstructor
public class SlideContentHistoryController {

    private final SlideContentHistoryService slideContentHistoryService;

    @GetMapping
    public ResponseEntity<List<SlideContentHistoryDTO>> getHistory(@RequestParam String slideId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(slideContentHistoryService.getHistoryForSlide(slideId, page, size));
    }

    @GetMapping("/detail")
    public ResponseEntity<SlideContentHistoryDTO> getHistoryDetail(@RequestParam String slideId,
            @RequestParam Long historyId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(slideContentHistoryService.getHistoryDetail(slideId, historyId));
    }

    @PostMapping("/restore")
    public ResponseEntity<SlideContentRestoreResponseDTO> restore(@RequestParam String slideId,
            @RequestParam Long historyId,
            @RequestParam(defaultValue = "DRAFT") String source,
            @RequestParam(required = false) String chapterId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity
                .ok(slideContentHistoryService.restore(slideId, historyId, source, chapterId, user));
    }
}
