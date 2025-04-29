package vacademy.io.admin_core_service.features.chapter.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTO;
import vacademy.io.admin_core_service.features.chapter.dto.UpdateChapterOrderDTO;
import vacademy.io.admin_core_service.features.chapter.service.ChapterService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/chapter/v1")
@RequiredArgsConstructor
public class ChapterController {
    private final ChapterService chapterService;

    @PostMapping("/add-chapter")
    public ResponseEntity<ChapterDTO> addChapter(@RequestBody ChapterDTO chapterDTO, @RequestAttribute("user") CustomUserDetails user, @RequestParam("moduleId") String moduleId, @RequestParam("commaSeparatedPackageSessionIds") String commaSeparatedPackageSessionIds) {
        return ResponseEntity.ok(chapterService.addChapter(chapterDTO, moduleId, commaSeparatedPackageSessionIds, user));
    }

    @PutMapping("/update-chapter")
    public ResponseEntity<String> updateChapter(@RequestBody ChapterDTO chapterDTO, @RequestAttribute("user") CustomUserDetails user,
                                                @RequestParam("chapterId") String chapterId,
                                                @RequestParam("moduleId") String moduleId,
                                                @RequestParam("commaSeparatedPackageSessionIds") String commaSeparatedPackageSessionIds) {
        return ResponseEntity.ok(chapterService.updateChapter(chapterId, moduleId, chapterDTO, commaSeparatedPackageSessionIds, user));
    }

    /**
     * Updates the order of chapters for a session.
     *
     * @param updateChapterOrderDTOS List of UpdateChapterOrderDTO containing chapter order updates.
     * @return ResponseEntity with success message.
     */
    @PutMapping("/update-chapter-order")
    public ResponseEntity<String> updateChapterOrder(@RequestBody List<UpdateChapterOrderDTO> updateChapterOrderDTOS, @RequestAttribute("user") CustomUserDetails user) {
        String result = chapterService.updateChapterOrder(updateChapterOrderDTOS, user);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/delete-chapters")
    public ResponseEntity<String> deleteChapter(@RequestBody List<String> chapterIds, @RequestParam("packageSessionIds") String packageSessionIds, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(chapterService.deleteChapter(chapterIds, packageSessionIds, user));
    }

    @PostMapping("/copy")
    public ResponseEntity<String> copyChapter(
            @RequestParam String packageSessionId,
            @RequestParam String moduleId,
            @RequestParam String chapterId,
            @RequestAttribute("user") CustomUserDetails user) {
        String response = chapterService.copyChapter(packageSessionId, moduleId, chapterId, user);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/move")
    public ResponseEntity<String> moveChapter(
            @RequestParam String existingPackageSessionId,
            @RequestParam String newPackageSessionId,
            @RequestParam String moduleId,
            @RequestParam String chapterId,
            @RequestAttribute("user") CustomUserDetails user) {
        String response = chapterService.moveChapter(existingPackageSessionId, newPackageSessionId, moduleId, chapterId, user);
        return ResponseEntity.ok(response);
    }

}
